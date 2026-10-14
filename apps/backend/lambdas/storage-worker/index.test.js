import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.js";

import pg from "pg";

export const mockQuery = vi
  .spyOn(pg.Client.prototype, "query")
  .mockResolvedValue({ rows: [] });
export const mockConnect = vi
  .spyOn(pg.Client.prototype, "connect")
  .mockResolvedValue();
export const mockEnd = vi.spyOn(pg.Client.prototype, "end").mockResolvedValue();

describe("Storage Worker Lambda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue();
    mockEnd.mockResolvedValue();
  });

  it("should process SQS batch events and sync database state", async () => {
    const mockRecord = {
      body: JSON.stringify({
        matchId: "match_123",
        inningId: "inn_123",
        strikerName: "Batter 1",
        nonStrikerName: "Batter 2",
        bowlerName: "Bowler 1",
        syncOnly: true,
        currentOvers: 1,
        currentBalls: 0,
        totalRuns: 10,
        totalWickets: 0,
      }),
    };

    const event = { Records: [mockRecord] };

    const res = await handler(event);

    expect(res.statusCode).toBe(200);
    expect(mockConnect).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledTimes(7); // 3 Inserts, 2 assigns, Updates innings, updates matches

    // Assert the match update query contains matchId
    expect(mockQuery).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("UPDATE matches m"),
      expect.arrayContaining(["match_123"]),
    );

    expect(mockEnd).toHaveBeenCalled();
  });

  it("should process ball events and update aggregates", async () => {
    const mockRecord = {
      body: JSON.stringify({
        matchId: "match_123",
        inningId: "inn_123",
        syncOnly: false,
        ballData: {
          runs: 4,
          isExtra: false,
          isWicket: false,
          batterName: "Batter 1",
          bowlerName: "Bowler 1",
          overNumber: 1,
          ballNumber: 1,
        },
      }),
    };

    const event = { Records: [mockRecord] };

    const res = await handler(event);

    expect(res.statusCode).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(8); // 2 Inserts, 1 assign, Inning update, match update, ball_events insert, player update, bowler update
  });

  it.each(["RETIRED_HURT", "RETIRED_OUT"])(
    "does not count %s as a batter-faced ball",
    async (wicketType) => {
      const event = {
        Records: [
          {
            body: JSON.stringify({
              matchId: "match_123",
              inningId: "inn_123",
              syncOnly: false,
              ballData: {
                runs: 0,
                isExtra: false,
                extraType: "NONE",
                extraRuns: 0,
                isWicket: true,
                wicketType,
                batterName: "Batter 1",
                bowlerName: "Bowler 1",
                overNumber: 0,
                ballNumber: 1,
              },
            }),
          },
        ],
      };

      await handler(event);

      const batterUpdate = mockQuery.mock.calls.find(([query]) =>
        String(query).includes("balls_faced = balls_faced + $2"),
      );
      expect(batterUpdate?.[1][1]).toBe(0);
    },
  );

  it("should process undo events by deleting the last ball", async () => {
    // Mock the SELECT to return a ball
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "ball_123",
          runs: 4,
          is_wicket: false,
          batter_name: "Batter 1",
          bowler_name: "Bowler 1",
          extra_type: null,
        },
      ],
    });

    const mockRecord = {
      body: JSON.stringify({
        matchId: "match_123",
        inningId: "inn_123",
        undo: true,
      }),
    };

    const event = { Records: [mockRecord] };

    await handler(event);

    // Verify DELETE query was called
    expect(mockQuery).toHaveBeenCalledWith(
      "DELETE FROM ball_events WHERE id = $1",
      ["ball_123"],
    );
  });

  it.each(["RETIRED_HURT", "RETIRED_OUT"])(
    "does not decrement balls faced when undoing %s",
    async (wicketType) => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "ball_123",
            runs: 0,
            is_wicket: true,
            wicket_type: wicketType,
            batter_name: "Batter 1",
            bowler_name: "Bowler 1",
            extra_type: null,
          },
        ],
      });

      await handler({
        Records: [
          {
            body: JSON.stringify({
              matchId: "match_123",
              inningId: "inn_123",
              undo: true,
            }),
          },
        ],
      });

      const batterUpdate = mockQuery.mock.calls.find(([query]) =>
        String(query).includes("balls_faced = balls_faced - $2"),
      );
      expect(batterUpdate?.[1][1]).toBe(0);
    },
  );
});

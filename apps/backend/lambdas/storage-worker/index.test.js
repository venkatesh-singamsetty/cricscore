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

  it("should restore innings overs and balls when undoing a delivery", async () => {
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

    await handler({
      Records: [
        {
          body: JSON.stringify({
            matchId: "match_123",
            inningId: "inn_123",
            undo: true,
            currentOvers: 2,
            currentBalls: 3,
            explicitTotalRuns: 30,
            explicitTotalWickets: 1,
          }),
        },
      ],
    });

    const inningsUpdate = mockQuery.mock.calls.find(([query]) =>
      String(query).includes("UPDATE innings SET"),
    );
    expect(inningsUpdate?.[1][3]).toBe(2);
    expect(inningsUpdate?.[1][4]).toBe(3);
    expect(inningsUpdate?.[1][5]).toBe(30);
    expect(inningsUpdate?.[1][6]).toBe(1);
    expect(String(inningsUpdate?.[0])).toContain("total_runs = COALESCE($6");
  });

  it("should resolve temporary inn2_ inningId from database before updating", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "real-uuid-inn-2" }],
    });

    await handler({
      Records: [
        {
          body: JSON.stringify({
            matchId: "match_123",
            inningId: "inn2_1729290000000",
            syncOnly: true,
            currentOvers: 0,
            currentBalls: 1,
            explicitTotalRuns: 4,
            explicitTotalWickets: 0,
          }),
        },
      ],
    });

    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      "SELECT id FROM innings WHERE match_id = $1 ORDER BY inning_number DESC LIMIT 1",
      ["match_123"],
    );
    const inningsUpdate = mockQuery.mock.calls.find(([query]) =>
      String(query).includes("UPDATE innings SET"),
    );
    expect(inningsUpdate?.[1][5]).toBe(4);
    expect(inningsUpdate?.[1][7]).toBe("real-uuid-inn-2");
  });

  it("should resolve inn2_ inningId by exact inning_number = 2 when eventInningNumber is provided", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "real-uuid-inning-2" }],
    });

    await handler({
      Records: [
        {
          body: JSON.stringify({
            matchId: "match_123",
            inningId: "inn2_1729291111111",
            inningNumber: 2,
            syncOnly: true,
            currentOvers: 1,
            currentBalls: 0,
            explicitTotalRuns: 12,
            explicitTotalWickets: 1,
          }),
        },
      ],
    });

    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      "SELECT id FROM innings WHERE match_id = $1 AND inning_number = $2",
      ["match_123", 2],
    );
    const inningsUpdate = mockQuery.mock.calls.find(([query]) =>
      String(query).includes("UPDATE innings SET"),
    );
    expect(inningsUpdate?.[1][5]).toBe(12);
    expect(inningsUpdate?.[1][7]).toBe("real-uuid-inning-2");
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
        String(query).includes("balls_faced = GREATEST(0, balls_faced - $2)"),
      );
      expect(batterUpdate?.[1][1]).toBe(0);
    },
  );

  it("batches battingOrderNames into a single multi-row INSERT, guards against lagging ball regressions, and writes authoritative post-ball snapshots idempotently", async () => {
    await handler({
      Records: [
        {
          body: JSON.stringify({
            matchId: "match_123",
            inningId: "inn_123",
            syncOnly: false,
            currentOvers: 1,
            currentBalls: 2,
            explicitTotalRuns: 18,
            explicitTotalWickets: 1,
            runs: 13,
            ballsFaced: 4,
            fours: 0,
            sixes: 2,
            bowlerRuns: 15,
            bowlerWickets: 1,
            bowlerOvers: 1,
            bowlerBalls: 2,
            battingOrderNames: ["P1", "P2", "P3"],
            ballData: {
              runs: 6,
              isExtra: false,
              isWicket: false,
              batterName: "P1",
              bowlerName: "B1",
              overNumber: 1,
              ballNumber: 2,
            },
          }),
        },
      ],
    });

    const bulkInsertCall = mockQuery.mock.calls.find(([query]) =>
      String(query).includes(
        "INSERT INTO players (inning_id, name) VALUES ($1, $2),($1, $3),($1, $4) ON CONFLICT DO NOTHING",
      ),
    );
    expect(bulkInsertCall).toBeDefined();
    expect(bulkInsertCall?.[1]).toEqual(["inn_123", "P1", "P2", "P3"]);

    const inningsUpdate = mockQuery.mock.calls.find(([query]) =>
      String(query).includes("UPDATE innings SET"),
    );
    expect(String(inningsUpdate?.[0])).toContain(
      "WHEN (COALESCE($4, overs, 0) * 6 + COALESCE($5, balls, 0)) >= (COALESCE(overs, 0) * 6 + COALESCE(balls, 0))",
    );

    const batterSnapshotUpdate = mockQuery.mock.calls.find(
      ([query, params]) =>
        String(query).includes("UPDATE players") &&
        String(query).includes("runs = $1") &&
        params?.[9] === "P1",
    );
    expect(batterSnapshotUpdate).toBeDefined();
    expect(batterSnapshotUpdate?.[1]).toEqual([
      13,
      4,
      0,
      2,
      false,
      null,
      null,
      null,
      "inn_123",
      "P1",
    ]);

    const bowlerSnapshotUpdate = mockQuery.mock.calls.find(
      ([query, params]) =>
        String(query).includes("UPDATE bowlers") &&
        String(query).includes("runs_conceded = $1") &&
        params?.[5] === "B1",
    );
    expect(bowlerSnapshotUpdate).toBeDefined();
    expect(bowlerSnapshotUpdate?.[1]).toEqual([15, 1, 1, 2, "inn_123", "B1"]);
  });
});

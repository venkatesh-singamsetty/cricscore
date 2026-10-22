import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminPanel from "../components/AdminPanel";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      idToken: {
        toString: () => "mock-admin-jwt",
      },
    },
  }),
}));

describe("AdminPanel Component", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders user management directory and fetches users", async () => {
    const mockUsers = [
      {
        username: "user1",
        email: "scorer@cricscore.com",
        status: "CONFIRMED",
        isAdmin: false,
        isScorer: true,
      },
      {
        username: "user2",
        email: "admin@cricscore.com",
        status: "CONFIRMED",
        isAdmin: true,
        isScorer: true,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUsers,
    });

    render(<AdminPanel hubKey={1} isAdmin={true} />);

    expect(screen.getByText(/User Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Database Cleanup/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("scorer@cricscore.com")).toBeInTheDocument();
      expect(screen.getByText("admin@cricscore.com")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/users"),
      expect.objectContaining({
        headers: { Authorization: "Bearer mock-admin-jwt" },
      }),
    );
  });

  it("handles role promotion action (+ Admin) successfully", async () => {
    const mockUsers = [
      {
        username: "user1",
        email: "scorer@cricscore.com",
        status: "CONFIRMED",
        isAdmin: false,
        isScorer: true,
      },
    ];

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "User promoted to Admin successfully" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ ...mockUsers[0], isAdmin: true }],
      });

    render(<AdminPanel hubKey={1} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("scorer@cricscore.com")).toBeInTheDocument();
    });

    const promoteButton = screen.getByRole("button", { name: /\+ Admin/i });
    fireEvent.click(promoteButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/admin/users/roles"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            emailToPromote: "scorer@cricscore.com",
            role: "Admin",
          }),
        }),
      );
      expect(
        screen.getByText(/User promoted to Admin successfully/i),
      ).toBeInTheDocument();
    });
  });

  it("switches to Database Cleanup tab and back", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<AdminPanel hubKey={1} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText(/User Management/i)).toBeInTheDocument();
    });

    const dbCleanupButton = screen.getByRole("button", {
      name: /Database Cleanup/i,
    });
    fireEvent.click(dbCleanupButton);

    await waitFor(() => {
      expect(screen.getByText(/Delete Test Matches/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Delete Incomplete Matches/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Delete Guest Data/i)).toBeInTheDocument();
      expect(screen.getByText(/Delete All Matches/i)).toBeInTheDocument();
    });

    // Verify ordering
    const buttons = screen.getAllByRole("button");
    const bulkButtonLabels = buttons
      .map((b) => b.textContent)
      .filter(
        (t) =>
          t &&
          /Delete (Test Matches|Incomplete Matches|Guest Data|All Matches)/i.test(
            t,
          ),
      );
    expect(bulkButtonLabels[0]).toContain("Delete Test Matches");
    expect(bulkButtonLabels[1]).toContain("Delete Incomplete Matches");
    expect(bulkButtonLabels[2]).toContain("Delete Guest Data");
    expect(bulkButtonLabels[3]).toContain("Delete All Matches");

    const userMgmtButton = screen.getByRole("button", {
      name: /User Management/i,
    });
    fireEvent.click(userMgmtButton);

    await waitFor(() => {
      expect(screen.getByText(/System Access/i)).toBeInTheDocument();
    });
  });

  it("handles API error when fetching users fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Forbidden: Not an admin" }),
    });

    render(<AdminPanel hubKey={1} isAdmin={true} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Error fetching users: Forbidden: Not an admin/i),
      ).toBeInTheDocument();
    });
  });
});

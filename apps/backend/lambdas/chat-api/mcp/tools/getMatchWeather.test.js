import { describe, it, expect, vi, beforeEach } from "vitest";
const {
  getMatchWeatherTool,
  validateWeatherInput,
  buildCricketAdvisory,
} = require("./getMatchWeather");

describe("MCP Tool: get_match_weather", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("validates location and normalizes hoursAhead", () => {
    expect(validateWeatherInput({ location: "x" }).error).toContain(
      "at least 2 characters",
    );
    const valid = validateWeatherInput({
      location: "Chicago, IL",
      targetDate: "Tomorrow",
      hoursAhead: 4,
    });
    expect(valid.error).toBeNull();
    expect(valid.sanitized).toEqual({
      location: "Chicago, IL",
      targetDate: "tomorrow",
      hoursAhead: 4,
    });
  });

  it("returns cricket advisory based on rain probability and wind speed", () => {
    expect(
      buildCricketAdvisory([
        { rainProbabilityPercent: 75, precipitationMm: 3.2, windSpeedMph: 10 },
      ]),
    ).toContain("High risk of rain interruption");

    expect(
      buildCricketAdvisory([
        { rainProbabilityPercent: 5, precipitationMm: 0, windSpeedMph: 8 },
      ]),
    ).toContain("Ideal cricket weather expected");
  });

  it("fetches geocoding and hourly forecast for next N hours via Open-Meteo", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              name: "Chicago",
              admin1: "Illinois",
              country: "United States",
              latitude: 41.85,
              longitude: -87.65,
              timezone: "America/Chicago",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          timezone: "America/Chicago",
          current: {
            time: "2026-10-21T14:00",
            weather_code: 1,
            temperature_2m: 20,
            relative_humidity_2m: 55,
            wind_speed_10m: 12,
          },
          hourly: {
            time: ["2026-10-21T14:00", "2026-10-21T15:00", "2026-10-21T16:00"],
            temperature_2m: [20, 21, 19],
            apparent_temperature: [20, 21, 19],
            precipitation_probability: [10, 15, 20],
            precipitation: [0, 0, 0],
            weather_code: [1, 2, 2],
            wind_speed_10m: [12, 14, 15],
            wind_gusts_10m: [18, 20, 22],
            relative_humidity_2m: [55, 58, 60],
          },
        }),
      });

    const result = await getMatchWeatherTool({
      location: "Chicago, IL",
      targetDate: "today",
      hoursAhead: 3,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.location).toBe("Chicago, Illinois, United States");
    expect(parsed.hourlyForecast).toHaveLength(3);
    expect(parsed.cricketAdvisory).toContain("Ideal cricket weather");
  });
});

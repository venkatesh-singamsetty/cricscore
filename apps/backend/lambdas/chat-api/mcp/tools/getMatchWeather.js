const WMO_WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

/**
 * Validates and normalizes input for the match weather tool.
 *
 * @param {object} args
 * @param {string} args.location
 * @param {string} [args.targetDate]
 * @param {number} [args.hoursAhead]
 * @returns {{ error: string | null, sanitized?: { location: string, targetDate: string, hoursAhead: number } }}
 */
function validateWeatherInput({ location, targetDate, hoursAhead } = {}) {
  const cleanLocation = typeof location === "string" ? location.trim() : "";
  if (!cleanLocation || cleanLocation.length < 2) {
    return {
      error:
        "Please provide a valid city, ground, or location name (at least 2 characters).",
    };
  }

  const cleanTargetDate =
    typeof targetDate === "string" && targetDate.trim()
      ? targetDate.trim().toLowerCase()
      : "today";

  const parsedHours = Number(hoursAhead);
  const cleanHoursAhead = Number.isFinite(parsedHours)
    ? Math.max(1, Math.min(24, Math.round(parsedHours)))
    : 6;

  return {
    error: null,
    sanitized: {
      location: cleanLocation.slice(0, 100),
      targetDate: cleanTargetDate,
      hoursAhead: cleanHoursAhead,
    },
  };
}

/**
 * Resolves a location name (e.g., "Chicago, IL" or "Schaumburg") to coordinates using Open-Meteo Geocoding API (free, no key).
 *
 * @param {string} location
 * @returns {Promise<object | null>}
 */
async function geocodeLocation(location) {
  const candidates = [location];
  if (location.includes(",")) {
    const cityOnly = location.split(",")[0].trim();
    if (cityOnly && cityOnly !== location) {
      candidates.push(cityOnly);
    }
  }

  for (const query of candidates) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    if (Array.isArray(data.results) && data.results.length > 0) {
      return data.results[0];
    }
  }
  return null;
}

/**
 * Builds a cricket-specific advisory from hourly slices.
 *
 * @param {Array<object>} hourlySlice
 * @returns {string}
 */
function buildCricketAdvisory(hourlySlice) {
  if (!hourlySlice.length) {
    return "No hourly forecast data available for the requested window.";
  }
  const maxRainProb = Math.max(
    ...hourlySlice.map((h) => h.rainProbabilityPercent || 0),
  );
  const totalPrecipMm = hourlySlice.reduce(
    (sum, h) => sum + (h.precipitationMm || 0),
    0,
  );
  const maxWindMph = Math.max(...hourlySlice.map((h) => h.windSpeedMph || 0));

  if (maxRainProb >= 60 || totalPrecipMm >= 2.0) {
    return `High risk of rain interruption (up to ${maxRainProb}% rain probability, ~${totalPrecipMm.toFixed(1)} mm total precipitation). Keep DLS par score projections ready in case of overs reduction.`;
  }
  if (maxRainProb >= 30 || totalPrecipMm > 0) {
    return `Passing showers possible (up to ${maxRainProb}% rain probability). Cloud cover and humidity may assist swing bowlers; monitor conditions for brief delays.`;
  }
  if (maxWindMph >= 20) {
    return `Dry conditions expected (${maxRainProb}% max rain probability), but breezy with winds up to ${maxWindMph} mph—captains and bowlers should factor crosswinds into boundary defense.`;
  }
  return `Ideal cricket weather expected (${maxRainProb}% max rain probability, dry conditions). Full uninterrupted match likely without DLS rain delays.`;
}

/**
 * MCP Tool: get_match_weather
 *
 * Fetches real-time and hourly weather forecast for a cricket match location
 * using the free Open-Meteo API (zero cost, no API key required).
 *
 * @param {object} args
 * @param {string} args.location - City or venue location (e.g., "Chicago, IL")
 * @param {string} [args.targetDate] - "today", "tomorrow", or "YYYY-MM-DD"
 * @param {number} [args.hoursAhead] - Number of hours ahead for live/today forecast (default 6)
 * @returns {Promise<object>} MCP content response
 */
async function getMatchWeatherTool(args = {}) {
  const { error, sanitized } = validateWeatherInput(args);
  if (error) {
    return {
      content: [{ type: "text", text: `Error fetching weather: ${error}` }],
    };
  }

  try {
    const place = await geocodeLocation(sanitized.location);
    if (!place) {
      return {
        content: [
          {
            type: "text",
            text: `Could not find coordinates for location "${sanitized.location}". Please try a nearby city name (e.g., "Chicago", "Schaumburg", "Dallas").`,
          },
        ],
      };
    }

    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m` +
      `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m` +
      `&timezone=auto&forecast_days=7`;

    const forecastRes = await fetch(forecastUrl);
    if (!forecastRes.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching weather forecast: Weather service returned HTTP ${forecastRes.status}.`,
          },
        ],
      };
    }

    const forecast = await forecastRes.json();
    const hourly = forecast.hourly || {};
    const times = Array.isArray(hourly.time) ? hourly.time : [];

    const toF = (c) => Math.round((c * 9) / 5 + 32);
    const toMph = (kmh) => Math.round(kmh * 0.621371);

    const allHours = times.map((t, idx) => {
      const tempC = hourly.temperature_2m?.[idx] ?? 0;
      const feelsC = hourly.apparent_temperature?.[idx] ?? tempC;
      const windKmh = hourly.wind_speed_10m?.[idx] ?? 0;
      const gustKmh = hourly.wind_gusts_10m?.[idx] ?? 0;
      const code = hourly.weather_code?.[idx] ?? 0;
      return {
        time: t,
        condition: WMO_WEATHER_CODES[code] || "Partly cloudy",
        tempC: Math.round(tempC),
        tempF: toF(tempC),
        feelsLikeF: toF(feelsC),
        rainProbabilityPercent: hourly.precipitation_probability?.[idx] ?? 0,
        precipitationMm: hourly.precipitation?.[idx] ?? 0,
        humidityPercent: hourly.relative_humidity_2m?.[idx] ?? 0,
        windSpeedMph: toMph(windKmh),
        windGustsMph: toMph(gustKmh),
      };
    });

    const currentTimeIso = forecast.current?.time || times[0] || "";
    const todayDateStr = currentTimeIso.slice(0, 10);

    let selectedHours = [];
    let windowDescription = "";

    if (sanitized.targetDate === "tomorrow") {
      const distinctDates = Array.from(
        new Set(times.map((t) => t.slice(0, 10))),
      );
      const todayIdx = Math.max(0, distinctDates.indexOf(todayDateStr));
      const tomorrowDateStr =
        distinctDates[todayIdx + 1] || distinctDates[1] || todayDateStr;
      selectedHours = allHours.filter((h) => {
        if (!h.time.startsWith(tomorrowDateStr)) return false;
        const hourNum = parseInt(h.time.slice(11, 13), 10);
        return hourNum >= 8 && hourNum <= 21;
      });
      windowDescription = `Tomorrow (${tomorrowDateStr}) Match-Day Hourly Forecast (08:00–21:00 local time)`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(sanitized.targetDate)) {
      selectedHours = allHours.filter((h) => {
        if (!h.time.startsWith(sanitized.targetDate)) return false;
        const hourNum = parseInt(h.time.slice(11, 13), 10);
        return hourNum >= 8 && hourNum <= 21;
      });
      windowDescription = `Date (${sanitized.targetDate}) Match-Day Hourly Forecast (08:00–21:00 local time)`;
    } else {
      const startIdx = Math.max(
        0,
        allHours.findIndex((h) => h.time >= currentTimeIso),
      );
      selectedHours = allHours.slice(startIdx, startIdx + sanitized.hoursAhead);
      windowDescription = `Next ${sanitized.hoursAhead} Hours Live Match Forecast`;
    }

    const currentSummary = forecast.current
      ? {
          time: forecast.current.time,
          condition:
            WMO_WEATHER_CODES[forecast.current.weather_code] || "Partly cloudy",
          tempC: Math.round(forecast.current.temperature_2m ?? 0),
          tempF: toF(forecast.current.temperature_2m ?? 0),
          humidityPercent: forecast.current.relative_humidity_2m ?? 0,
          windSpeedMph: toMph(forecast.current.wind_speed_10m ?? 0),
        }
      : null;

    const locationLabel = [place.name, place.admin1, place.country]
      .filter(Boolean)
      .join(", ");

    const payload = {
      location: locationLabel,
      timezone: forecast.timezone || place.timezone || "UTC",
      window: windowDescription,
      current: currentSummary,
      hourlyForecast: selectedHours,
      cricketAdvisory: buildCricketAdvisory(selectedHours),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    };
  } catch (err) {
    console.error("MCP Tool [get_match_weather] error:", err.message);
    return {
      content: [
        {
          type: "text",
          text: "Error fetching weather forecast: Unable to reach Open-Meteo weather service.",
        },
      ],
    };
  }
}

module.exports = {
  getMatchWeatherTool,
  validateWeatherInput,
  buildCricketAdvisory,
  WMO_WEATHER_CODES,
};

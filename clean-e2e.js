const API_URL = "https://ispht71fh0.execute-api.us-east-1.amazonaws.com";

async function clean() {
  const res = await fetch(`${API_URL}/matches`);
  const matches = await res.json();

  const testMatches = matches.filter(
    (m) =>
      (m.team_a_name === "CHICAGO SPARTANS" &&
        m.team_b_name === "SHARK BLUE") ||
      (m.team_a_name === "SHARK BLUE" && m.team_b_name === "CHICAGO SPARTANS"),
  );

  console.log(`Found ${testMatches.length} test matches to delete.`);

  for (const m of testMatches) {
    console.log(`Deleting match ${m.id}...`);
    const delRes = await fetch(`${API_URL}/match/${m.id}`, {
      method: "DELETE",
    });
    if (delRes.ok) {
      console.log(`Deleted ${m.id}`);
    } else {
      console.log(`Failed to delete ${m.id}`);
    }
  }
}

clean();

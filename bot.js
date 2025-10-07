import fs from "fs";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";

// Load secrets from environment variables
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Missing TOKEN or CLIENT_ID environment variables.");
  process.exit(1);
}

// ===== EXPRESS SERVER (Dashboard + status.json) =====
const app = express();

// Serve static files (dashboard.html + status.json)
app.use(express.static("./"));

// Serve dashboard
app.get("/", (_, res) => res.sendFile(process.cwd() + "/dashboard.html"));

// Start web server
app.listen(PORT, () => console.log(`✅ Dashboard running on port ${PORT}`));

// ===== DISCORD BOT SETUP =====
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ===== REGISTER SLASH COMMANDS =====
const commands = [
  {
    name: "status",
    description: "Manage or check system status",
    options: [
      {
        type: 1,
        name: "set",
        description: "Set the current status",
        options: [
          {
            name: "mode",
            type: 3,
            description: "Choose a status mode",
            required: true,
            choices: [
              { name: "Down", value: "down" },
              { name: "Risk", value: "risk" },
              { name: "Good", value: "good" }
            ]
          }
        ]
      },
      {
        type: 1,
        name: "check",
        description: "Check the current status"
      }
    ]
  }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("🔧 Registering slash commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Commands registered globally!");
  } catch (err) {
    console.error("⚠️ Failed to register commands:", err);
  }
})();

// ===== HANDLE DISCORD COMMANDS =====
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "status") return;

  // Create status.json if missing
  if (!fs.existsSync("status.json")) {
    fs.writeFileSync(
      "status.json",
      JSON.stringify({ status: "good", statusText: "Undetected - Working Fine" }, null, 2)
    );
  }

  // /status set
  if (interaction.options.getSubcommand() === "set") {
    const mode = interaction.options.getString("mode");
    const statuses = {
      down: { status: "down", statusText: "Status: DOWN" },
      risk: { status: "risk", statusText: "Risk: Being Banned" },
      good: { status: "good", statusText: "Undetected - Working Fine" }
    };

    const data = statuses[mode];
    fs.writeFileSync("status.json", JSON.stringify(data, null, 2));
    console.log(data.statusText); // print to console
    await interaction.reply(data.statusText); // reply with only text
  }

  // /status check
  if (interaction.options.getSubcommand() === "check") {
    try {
      const data = JSON.parse(fs.readFileSync("status.json"));
      console.log(data.statusText);
      await interaction.reply(data.statusText);
    } catch (err) {
      console.error("⚠️ Error reading status.json:", err);
      await interaction.reply("⚠️ Could not read current status.");
    }
  }
});

client.login(TOKEN);

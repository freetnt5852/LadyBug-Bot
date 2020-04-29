const { Client } = require("discord.js");
const CommandStore = require("./CommandStore.js");
const EventStore = require("./EventStore.js");
const MemorySweeper = require("../utils/cleanup.js");
const Points = require("../monitors/points.js"); // Implement better way when we have more monitors.
const { Pool } = require("pg");
const DBL = require("dblapi.js");
const loadSchema = require("../utils/schema.js");
const Settings = require("./Settings.js");

class MiyakoClient extends Client {
  constructor() {
    super({
      fetchAllMembers: false,
      disableMentions: "everyone",
      messageCacheMaxSize: 100,
      messageCacheLifetime: 240,
      messageSweepInterval: 300
    });
    
    this.config = require("../config.json");
    this.console = console; // TODO: Implement a console logger.
    this.constants = require("../utils/constants.js");
    this.commands = new CommandStore(this);
    this.utils = require("../utils/Utils.js"); // Easier to access everywhere.
    this.events = new EventStore(this);
    this.sweeper = new MemorySweeper(this);
    this.responses = require("../utils/responses.js");
    this.settings = new Settings(this, "guilds");
    this.members = new Settings(this, "members");
    this.dbl = new DBL(this.config.dbl, this);
    this.points = new Points(this);
    this.on("ready", this.onReady.bind(this));

    const { user, password, database } = this.config.postgresql;
    this.db = new Pool({ user, password, database });
    this.dbconn = null;
  }

  onReady() {
    this.ready = true;
    this.console.log(`Logged in as ${this.user.tag}`);
    this.emit("miyakoReady");
  }

  async login() {
    await this.init();
    return super.login(this.config.token);
  }
  
  async init() {
    // Load pieces.
    const [commands, events] = await Promise.all([this.commands.loadFiles(), this.events.loadFiles()]);
    this.console.log(`Loaded ${commands} commands.`);
    this.console.log(`Loaded ${events} events.`);

    // Connect database.
    this.dbconn = await this.db.connect();
    this.console.log("Connected to PostgreSQL");
    await loadSchema(this.db);
    await this.settings.init();
    await this.members.init();
  }
}

module.exports = MiyakoClient;

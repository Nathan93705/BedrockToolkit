import { world } from "@minecraft/server";

export class SimpleDB {
    /**
     * Constructs a new database instance.
     * @param {string} name - The unique name of the database.
     * @param {number} [chunkSize=1000] - The maximum size per chunk when storing data.
     */
    constructor(name, chunkSize = 1000) {
        this.name = name;
        this.chunkSize = chunkSize;
        this.memory = {}; // In-memory cache of the database
        this.initialized = false; // Tracks initialization state
        this.initialize();
    }

    /**
     * Initializes the database by loading existing data from storage.
     * Ensures initialization happens only once.
     */
    initialize() {
        if (this.initialized) return;
        this.loadMemory();
        this.initialized = true;
    }

    /**
     * Loads stored database data from `world` into memory.
     * Reads metadata and reconstructs the stored JSON.
     */
    loadMemory() {
        // Retrieve metadata, which contains chunk count
        const metadata = world.getDynamicProperty(`db_${this.name}`);
        if (!metadata) {
            this.memory = {}; // No data found, initialize as empty
            return;
        }

        let config;
        try {
            config = JSON.parse(metadata); // Parse stored metadata
        } catch {
            this.memory = {}; // If corrupted, reset database
            return;
        }

        const chunks = [];
        for (let i = 0; i < config.totalChunks; i++) {
            const chunk = world.getDynamicProperty(`db_${this.name}_${i}`);
            if (chunk) chunks.push(chunk);
        }

        try {
            // Reconstruct the stored JSON from chunks
            const serializedMemory = chunks.join('');
            this.memory = JSON.parse(serializedMemory);
        } catch {
            this.memory = {}; // Reset if corrupted
        }
    }

    /**
     * Saves the current state of the database to `world`.
     * Data is split into chunks to fit within storage limitations.
     */
    saveMemory() {
        // Serialize the entire database memory
        const serializedMemory = JSON.stringify(this.memory);
        // Split into manageable chunks
        const chunks = this.sectionString(serializedMemory, this.chunkSize);

        // Create metadata for storage
        const config = {
            chunkSize: this.chunkSize,
            totalChunks: chunks.length
        };

        // Store metadata
        world.setDynamicProperty(`db_${this.name}`, JSON.stringify(config));

        // Remove old chunks to avoid stale data
        world.getDynamicPropertyIds()
            .filter(id => id.startsWith(`db_${this.name}_`))
            .forEach(id => world.setDynamicProperty(id, undefined)); // Undefined removes property

        // Store new chunks
        chunks.forEach((chunk, i) => {
            world.setDynamicProperty(`db_${this.name}_${i}`, chunk);
        });
    }

    /**
     * Retrieves a value from the database by key.
     * @param {string} key - The key to retrieve.
     * @returns {*} The stored value or `undefined` if not found.
     */
    get(key) {
        return this.memory[key];
    }

    /**
     * Stores a value in the database.
     * @param {string} key - The key to store the value under.
     * @param {*} value - The value to store.
     */
    set(key, value) {
        if (!this.validateType(value)) 
            throw new Error("Invalid value type. Must be string, number, boolean, object, or array.");
        this.memory[key] = value;
        this.saveMemory();
    }

    /**
     * Deletes a key from the database.
     * @param {string} key - The key to remove.
     */
    delete(key) {
        if (key in this.memory) {
            delete this.memory[key];
            this.saveMemory();
        }
    }

    /**
     * Clears all stored data from the database.
     * Removes both in-memory and persistent storage data.
     */
    clear() {
        this.memory = {};
        this.saveMemory();
    }

    /**
     * Checks if a key exists in the database.
     * @param {string} key - The key to check.
     * @returns {boolean} `true` if the key exists, otherwise `false`.
     */
    has(key) {
        return key in this.memory;
    }

    /**
     * Retrieves all stored key-value pairs from the database.
     * @returns {Object} A copy of the database memory.
     */
    getAll() {
        return { ...this.memory };
    }

    /**
     * Splits a string into smaller sections of a given length.
     * Used to ensure data fits within storage limitations.
     * @param {string} string - The string to split.
     * @param {number} sectionLength - The maximum length per section.
     * @returns {string[]} An array of string sections.
     */
    sectionString(string, sectionLength) {
        return string.match(new RegExp(`.{1,${sectionLength}}`, 'g')) || [];
    }

    /**
     * Ensures the value matches the allowed database types.
     * @param {any} value - The value to validate.
     * @returns {boolean} - Whether the value is valid.
     */
    validateType(value) {
        if (value == null) return true;
        const type = typeof value;
        switch (type) {
            case "string":
            case "number":
            case "boolean":
                return true;

            case "object":
                if (Array.isArray(value)) return value.every(this.validateType);
                return Object.values(value).every(this.validateType);
        }
    }
}

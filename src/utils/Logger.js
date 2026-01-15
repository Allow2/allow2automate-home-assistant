// Copyright [2026] [Allow2 Pty Ltd]
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
'use strict';

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

class Logger {
    constructor(prefix = '[HA Plugin]', minLevel = LOG_LEVELS.INFO) {
        this.prefix = prefix;
        this.minLevel = minLevel;
    }

    setLevel(level) {
        this.minLevel = level;
    }

    debug(...args) {
        if (this.minLevel <= LOG_LEVELS.DEBUG) {
            console.log(this.prefix, '[DEBUG]', ...args);
        }
    }

    info(...args) {
        if (this.minLevel <= LOG_LEVELS.INFO) {
            console.log(this.prefix, '[INFO]', ...args);
        }
    }

    warn(...args) {
        if (this.minLevel <= LOG_LEVELS.WARN) {
            console.warn(this.prefix, '[WARN]', ...args);
        }
    }

    error(...args) {
        if (this.minLevel <= LOG_LEVELS.ERROR) {
            console.error(this.prefix, '[ERROR]', ...args);
        }
    }

    log(...args) {
        this.info(...args);
    }
}

// Default logger instance
const logger = new Logger('[HA Plugin]', LOG_LEVELS.DEBUG);

export { Logger, LOG_LEVELS, logger };
export default logger;

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

/**
 * Tests for HAConnectionManager
 */

describe('HAConnectionManager', () => {
    let HAConnectionManager;
    let manager;

    beforeEach(() => {
        jest.resetModules();
        HAConnectionManager = require('../src/controllers/HAConnectionManager').default;
    });

    afterEach(() => {
        if (manager) {
            manager.disconnect();
        }
    });

    describe('constructor', () => {
        it('should create instance with default config', () => {
            manager = new HAConnectionManager();
            expect(manager).toBeDefined();
            expect(manager.isConfigured()).toBe(false);
        });

        it('should create instance with provided config', () => {
            manager = new HAConnectionManager({
                url: 'http://localhost:8123',
                accessToken: 'test-token'
            });
            expect(manager.isConfigured()).toBe(true);
        });
    });

    describe('configure', () => {
        it('should update configuration', () => {
            manager = new HAConnectionManager();
            manager.configure({
                url: 'http://localhost:8123',
                accessToken: 'new-token'
            });
            expect(manager.isConfigured()).toBe(true);
        });
    });

    describe('getStatus', () => {
        it('should return connection status', () => {
            manager = new HAConnectionManager({
                url: 'http://localhost:8123',
                accessToken: 'test-token'
            });
            const status = manager.getStatus();
            expect(status.configured).toBe(true);
            expect(status.connected).toBe(false);
            expect(status.authenticated).toBe(false);
        });
    });
});

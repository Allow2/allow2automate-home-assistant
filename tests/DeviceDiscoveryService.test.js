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
 * Tests for DeviceDiscoveryService
 */

describe('DeviceDiscoveryService', () => {
    let DeviceDiscoveryService;
    let service;
    let mockConnection;

    beforeEach(() => {
        jest.resetModules();
        DeviceDiscoveryService = require('../src/controllers/DeviceDiscoveryService').default;

        mockConnection = {
            getStates: jest.fn().mockResolvedValue([])
        };

        service = new DeviceDiscoveryService(mockConnection);
    });

    describe('classifyEntity', () => {
        it('should classify Xbox entities', () => {
            const entity = {
                entity_id: 'media_player.xbox_series_x',
                state: 'on',
                attributes: {
                    friendly_name: 'Xbox Series X'
                }
            };

            const result = service.classifyEntity(entity);
            expect(result).not.toBeNull();
            expect(result.type).toBe('gaming_console');
            expect(result.platform).toBe('xbox');
        });

        it('should classify PlayStation entities', () => {
            const entity = {
                entity_id: 'media_player.playstation_5',
                state: 'on',
                attributes: {
                    friendly_name: 'PlayStation 5'
                }
            };

            const result = service.classifyEntity(entity);
            expect(result).not.toBeNull();
            expect(result.type).toBe('gaming_console');
            expect(result.platform).toBe('playstation');
        });

        it('should classify Smart TV entities', () => {
            const entity = {
                entity_id: 'media_player.living_room_tv',
                state: 'on',
                attributes: {
                    friendly_name: 'Living Room Samsung TV'
                }
            };

            const result = service.classifyEntity(entity);
            expect(result).not.toBeNull();
            expect(result.type).toBe('smart_tv');
            expect(result.platform).toBe('samsung');
        });

        it('should classify Roku entities', () => {
            const entity = {
                entity_id: 'media_player.roku_ultra',
                state: 'idle',
                attributes: {
                    friendly_name: 'Roku Ultra'
                }
            };

            const result = service.classifyEntity(entity);
            expect(result).not.toBeNull();
            expect(result.type).toBe('media_player');
            expect(result.platform).toBe('roku');
        });

        it('should classify Smart Plug entities', () => {
            const entity = {
                entity_id: 'switch.gaming_plug',
                state: 'on',
                attributes: {
                    friendly_name: 'Gaming Room Plug',
                    current_power_w: 150
                }
            };

            const result = service.classifyEntity(entity);
            expect(result).not.toBeNull();
            expect(result.type).toBe('smart_plug');
        });

        it('should return null for unsupported entities', () => {
            const entity = {
                entity_id: 'sensor.temperature',
                state: '23',
                attributes: {
                    friendly_name: 'Temperature Sensor'
                }
            };

            const result = service.classifyEntity(entity);
            expect(result).toBeNull();
        });
    });

    describe('suggestLinks', () => {
        it('should suggest links based on child name in device name', () => {
            // Add a device
            service.devices.set('media_player.bobby_xbox', {
                entityId: 'media_player.bobby_xbox',
                type: 'gaming_console',
                name: "Bobby's Xbox"
            });

            const children = [
                { id: 123, name: 'Bobby' },
                { id: 456, name: 'Sarah' }
            ];

            const suggestions = service.suggestLinks(children);
            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions[0].childId).toBe(123);
            expect(suggestions[0].childName).toBe('Bobby');
        });
    });
});

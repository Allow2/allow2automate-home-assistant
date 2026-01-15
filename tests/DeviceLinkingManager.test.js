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
 * Tests for DeviceLinkingManager
 */

describe('DeviceLinkingManager', () => {
    let DeviceLinkingManager;
    let manager;

    beforeEach(() => {
        jest.resetModules();
        DeviceLinkingManager = require('../src/controllers/DeviceLinkingManager').default;
        manager = new DeviceLinkingManager();
    });

    describe('addLink', () => {
        it('should add exclusive link', () => {
            const link = {
                entityId: 'media_player.xbox',
                childId: 123,
                deviceName: 'Xbox',
                linkType: 'exclusive'
            };

            const result = manager.addLink(link);
            expect(result).toBe(true);
            expect(manager.getLink('media_player.xbox')).not.toBeNull();
        });

        it('should track child devices for exclusive links', () => {
            manager.addLink({
                entityId: 'media_player.xbox',
                childId: 123,
                linkType: 'exclusive'
            });

            const devices = manager.getChildDevices(123);
            expect(devices).toContain('media_player.xbox');
        });
    });

    describe('removeLink', () => {
        it('should remove link', () => {
            manager.addLink({
                entityId: 'media_player.xbox',
                childId: 123,
                linkType: 'exclusive'
            });

            const result = manager.removeLink('media_player.xbox');
            expect(result).toBe(true);
            expect(manager.getLink('media_player.xbox')).toBeNull();
        });
    });

    describe('resolveActiveChild', () => {
        it('should return child for exclusive device', () => {
            manager.addLink({
                entityId: 'media_player.xbox',
                childId: 123,
                linkType: 'exclusive'
            });

            const childId = manager.resolveActiveChild('media_player.xbox');
            expect(childId).toBe(123);
        });

        it('should return null for family device', () => {
            manager.addLink({
                entityId: 'media_player.tv',
                linkType: 'family'
            });

            const childId = manager.resolveActiveChild('media_player.tv');
            expect(childId).toBeNull();
        });

        it('should return correct child for shared device with time rules', () => {
            const now = new Date();
            const hour = now.getHours();
            const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];

            manager.addLink({
                entityId: 'media_player.tv',
                linkType: 'shared',
                usageRules: [
                    {
                        childId: 123,
                        weekdays: [dayName],
                        timeRange: `${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`
                    }
                ]
            });

            const childId = manager.resolveActiveChild('media_player.tv', now);
            expect(childId).toBe(123);
        });
    });

    describe('exportLinks', () => {
        it('should export all links', () => {
            manager.addLink({
                entityId: 'media_player.xbox',
                childId: 123,
                deviceName: 'Xbox',
                linkType: 'exclusive'
            });

            manager.addLink({
                entityId: 'media_player.tv',
                deviceName: 'Family TV',
                linkType: 'family'
            });

            const exported = manager.exportLinks();
            expect(exported.length).toBe(2);
        });
    });
});

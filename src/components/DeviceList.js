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

import React, { Component } from 'react';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import RefreshIcon from '@material-ui/icons/Refresh';

/**
 * Device type display names and icons
 */
const DEVICE_TYPE_INFO = {
    gaming_console: { label: 'Gaming Console', color: '#9c27b0' },
    smart_tv: { label: 'Smart TV', color: '#2196f3' },
    media_player: { label: 'Media Player', color: '#ff9800' },
    smart_plug: { label: 'Smart Plug', color: '#4caf50' }
};

/**
 * State colors
 */
const STATE_COLORS = {
    on: '#4caf50',
    playing: '#4caf50',
    paused: '#ff9800',
    idle: '#9e9e9e',
    off: '#f44336',
    unavailable: '#f44336',
    unknown: '#9e9e9e'
};

class DeviceList extends Component {
    constructor(props) {
        super(props);
        this.state = {
            scanning: false
        };
    }

    handleScan = async () => {
        this.setState({ scanning: true });

        try {
            await this.props.ipc.invoke('ha:discoverDevices');
        } catch (error) {
            console.error('Device scan failed:', error);
        }

        this.setState({ scanning: false });
    };

    handleLinkDevice = (device) => {
        if (this.props.onLinkDevice) {
            this.props.onLinkDevice(device);
        }
    };

    handleUnlinkDevice = async (device) => {
        try {
            await this.props.ipc.invoke('ha:unlinkDevice', {
                entityId: device.entityId
            });
        } catch (error) {
            console.error('Failed to unlink device:', error);
        }
    };

    getDeviceTypeInfo(type) {
        return DEVICE_TYPE_INFO[type] || { label: type, color: '#9e9e9e' };
    }

    getStateColor(state) {
        const normalizedState = (state || 'unknown').toLowerCase();
        return STATE_COLORS[normalizedState] || STATE_COLORS.unknown;
    }

    renderDeviceRow(device, link, activeSessions) {
        const typeInfo = this.getDeviceTypeInfo(device.type);
        const stateColor = this.getStateColor(device.state);
        const isLinked = !!link;
        const isActive = activeSessions?.some(s => s.entityId === device.entityId);

        // Find linked child info
        let linkedChild = null;
        if (link && link.childId && this.props.children) {
            linkedChild = Object.values(this.props.children).find(c => c.id === link.childId);
        }

        return (
            <TableRow key={device.entityId}>
                <TableCell>
                    <Box display="flex" alignItems="center">
                        <Box>
                            <Typography variant="body1">
                                {device.name}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                {device.entityId}
                            </Typography>
                        </Box>
                    </Box>
                </TableCell>

                <TableCell>
                    <Chip
                        size="small"
                        label={typeInfo.label}
                        style={{
                            backgroundColor: typeInfo.color,
                            color: 'white'
                        }}
                    />
                    {device.platform && device.platform !== 'generic' && (
                        <Typography
                            variant="caption"
                            color="textSecondary"
                            style={{ marginLeft: 8 }}
                        >
                            ({device.platform})
                        </Typography>
                    )}
                </TableCell>

                <TableCell>
                    <Box display="flex" alignItems="center">
                        <Box
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: stateColor,
                                marginRight: 8
                            }}
                        />
                        <Typography variant="body2">
                            {device.state || 'Unknown'}
                        </Typography>
                        {isActive && (
                            <Chip
                                size="small"
                                label="Active"
                                style={{
                                    marginLeft: 8,
                                    backgroundColor: '#ff9800',
                                    color: 'white'
                                }}
                            />
                        )}
                    </Box>
                </TableCell>

                <TableCell>
                    {linkedChild ? (
                        <Box display="flex" alignItems="center">
                            <Typography variant="body2">
                                {linkedChild.name}
                            </Typography>
                            {link.linkType === 'shared' && (
                                <Chip
                                    size="small"
                                    label="Shared"
                                    style={{ marginLeft: 8 }}
                                />
                            )}
                        </Box>
                    ) : link?.linkType === 'family' ? (
                        <Typography variant="body2" color="textSecondary">
                            Family Device
                        </Typography>
                    ) : (
                        <Typography variant="body2" color="textSecondary">
                            Not linked
                        </Typography>
                    )}
                </TableCell>

                <TableCell align="right">
                    {isLinked ? (
                        <Box>
                            <Button
                                size="small"
                                onClick={() => this.handleLinkDevice(device)}
                                style={{ marginRight: 8 }}
                            >
                                Edit
                            </Button>
                            <Button
                                size="small"
                                color="secondary"
                                onClick={() => this.handleUnlinkDevice(device)}
                            >
                                Unlink
                            </Button>
                        </Box>
                    ) : (
                        <Button
                            size="small"
                            color="primary"
                            onClick={() => this.handleLinkDevice(device)}
                        >
                            Link
                        </Button>
                    )}
                </TableCell>
            </TableRow>
        );
    }

    render() {
        const { devices, deviceLinks, activeSessions, connectionStatus } = this.props;
        const { scanning } = this.state;

        const isConnected = connectionStatus?.status === 'connected';
        const deviceList = devices ? Object.values(devices) : [];

        // Group devices by type
        const groupedDevices = deviceList.reduce((acc, device) => {
            const type = device.type || 'other';
            if (!acc[type]) {
                acc[type] = [];
            }
            acc[type].push(device);
            return acc;
        }, {});

        return (
            <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                        Discovered Devices
                        {deviceList.length > 0 && (
                            <Typography
                                component="span"
                                variant="body2"
                                color="textSecondary"
                                style={{ marginLeft: 8 }}
                            >
                                ({deviceList.length} found)
                            </Typography>
                        )}
                    </Typography>

                    <Button
                        variant="outlined"
                        startIcon={scanning ? <CircularProgress size={20} /> : <RefreshIcon />}
                        onClick={this.handleScan}
                        disabled={!isConnected || scanning}
                    >
                        {scanning ? 'Scanning...' : 'Scan for Devices'}
                    </Button>
                </Box>

                {!isConnected && (
                    <Box p={4} textAlign="center">
                        <Typography color="textSecondary">
                            Connect to Home Assistant to discover devices
                        </Typography>
                    </Box>
                )}

                {isConnected && deviceList.length === 0 && (
                    <Box p={4} textAlign="center">
                        <Typography variant="h6" gutterBottom>
                            No Devices Found
                        </Typography>
                        <Typography color="textSecondary">
                            Click "Scan for Devices" to discover entertainment devices in Home Assistant.
                        </Typography>
                    </Box>
                )}

                {deviceList.length > 0 && (
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Device</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>State</TableCell>
                                <TableCell>Linked To</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {deviceList
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(device => {
                                    const link = deviceLinks?.[device.entityId];
                                    return this.renderDeviceRow(device, link, activeSessions);
                                })
                            }
                        </TableBody>
                    </Table>
                )}
            </Box>
        );
    }
}

export default DeviceList;

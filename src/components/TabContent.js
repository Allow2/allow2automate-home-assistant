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
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import Chip from '@material-ui/core/Chip';

import ConnectionSetup from './ConnectionSetup';
import DeviceList from './DeviceList';
import DeviceLinking from './DeviceLinking';

class TabContent extends Component {
    constructor(props) {
        super(props);
        this.state = {
            currentTab: 0,
            linkingDevice: null,
            linkDialogOpen: false
        };
    }

    handleTabChange = (event, newValue) => {
        this.setState({ currentTab: newValue });
    };

    handleLinkDevice = (device) => {
        this.setState({
            linkingDevice: device,
            linkDialogOpen: true
        });
    };

    handleCloseLinkDialog = () => {
        this.setState({
            linkingDevice: null,
            linkDialogOpen: false
        });
    };

    getConnectionStatus() {
        const { data } = this.props;
        if (!data) return { status: 'disconnected' };

        return {
            status: data.connectionStatus?.connected ? 'connected' : 'disconnected',
            authenticated: data.connectionStatus?.authenticated,
            url: data.homeAssistant?.url
        };
    }

    renderActivityTab() {
        const { data, children } = this.props;
        const activeSessions = data?.activeSessions || [];
        const childList = children ? Object.values(children) : [];

        if (activeSessions.length === 0) {
            return (
                <Box p={4} textAlign="center">
                    <Typography variant="h6" gutterBottom>
                        No Active Sessions
                    </Typography>
                    <Typography color="textSecondary">
                        When children use linked devices, their activity will appear here.
                    </Typography>
                </Box>
            );
        }

        return (
            <Table>
                <TableBody>
                    {activeSessions.map(session => {
                        const child = childList.find(c => c.id === session.childId);
                        const device = data?.devices?.[session.entityId];
                        const minutes = Math.round((session.totalActiveTime || 0) / 60000);

                        return (
                            <TableRow key={session.entityId}>
                                <TableCell>
                                    <Typography variant="body1">
                                        {device?.name || session.entityId}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        {session.activityType}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    {child ? (
                                        <Typography variant="body1">{child.name}</Typography>
                                    ) : (
                                        <Typography color="textSecondary">Unknown</Typography>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        label={`${minutes} min`}
                                        color="primary"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        label={session.state?.state || 'Active'}
                                        style={{
                                            backgroundColor: session.state?.state === 'playing' ? '#4caf50' : '#ff9800',
                                            color: 'white'
                                        }}
                                    />
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    }

    renderUsageTab() {
        const { data, children } = this.props;
        const childList = children ? Object.values(children) : [];

        if (childList.length === 0) {
            return (
                <Box p={4} textAlign="center">
                    <Typography color="textSecondary">
                        No children configured in Allow2.
                    </Typography>
                </Box>
            );
        }

        return (
            <Box>
                {childList.map(child => {
                    const todayUsage = data?.todayUsage?.[child.id];
                    const breakdown = todayUsage?.breakdownMinutes || {};

                    return (
                        <Card key={child.id} style={{ marginBottom: 16 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    {child.name}
                                </Typography>

                                {todayUsage ? (
                                    <Box>
                                        <Typography variant="body1" gutterBottom>
                                            Today: {todayUsage.totalTimeMinutes || 0} minutes
                                        </Typography>

                                        <Box display="flex" flexWrap="wrap" gap={1}>
                                            {Object.entries(breakdown).map(([type, minutes]) => (
                                                <Chip
                                                    key={type}
                                                    size="small"
                                                    label={`${type}: ${minutes} min`}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                ) : (
                                    <Typography color="textSecondary">
                                        No usage recorded today
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </Box>
        );
    }

    render() {
        const { plugin, data, children, configurationUpdate, ipc, pluginDir } = this.props;
        const { currentTab, linkingDevice, linkDialogOpen } = this.state;

        if (!plugin || !data) {
            return (
                <Box p={4} textAlign="center">
                    <Typography>Loading...</Typography>
                </Box>
            );
        }

        const connectionStatus = this.getConnectionStatus();
        const devices = data.devices || {};
        const deviceLinks = data.deviceLinks || {};
        const activeSessions = data.activeSessions || [];

        // Separate smart plugs for power control selection
        const smartPlugs = Object.fromEntries(
            Object.entries(devices).filter(([_, d]) => d.type === 'smart_plug')
        );

        // Get existing link for editing
        const existingLink = linkingDevice
            ? deviceLinks[linkingDevice.entityId]
            : null;

        return (
            <Box>
                <Tabs
                    value={currentTab}
                    onChange={this.handleTabChange}
                    indicatorColor="primary"
                    textColor="primary"
                >
                    <Tab label="Connection" />
                    <Tab label="Devices" />
                    <Tab label="Activity" />
                    <Tab label="Usage" />
                </Tabs>

                {/* Connection Tab */}
                {currentTab === 0 && (
                    <Box p={3}>
                        <ConnectionSetup
                            config={data}
                            connectionStatus={connectionStatus}
                            configurationUpdate={configurationUpdate}
                            ipc={ipc}
                        />
                    </Box>
                )}

                {/* Devices Tab */}
                {currentTab === 1 && (
                    <Box p={3}>
                        <DeviceList
                            devices={devices}
                            deviceLinks={deviceLinks}
                            activeSessions={activeSessions}
                            children={children}
                            connectionStatus={connectionStatus}
                            onLinkDevice={this.handleLinkDevice}
                            ipc={ipc}
                        />
                    </Box>
                )}

                {/* Activity Tab */}
                {currentTab === 2 && (
                    <Box p={3}>
                        <Typography variant="h6" gutterBottom>
                            Active Sessions
                        </Typography>
                        {this.renderActivityTab()}
                    </Box>
                )}

                {/* Usage Tab */}
                {currentTab === 3 && (
                    <Box p={3}>
                        <Typography variant="h6" gutterBottom>
                            Today's Usage
                        </Typography>
                        {this.renderUsageTab()}
                    </Box>
                )}

                {/* Device Linking Dialog */}
                <DeviceLinking
                    open={linkDialogOpen}
                    onClose={this.handleCloseLinkDialog}
                    device={linkingDevice}
                    existingLink={existingLink}
                    children={children}
                    smartPlugs={smartPlugs}
                    ipc={ipc}
                />
            </Box>
        );
    }
}

export default TabContent;

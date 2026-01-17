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
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';

/**
 * Connection status indicators
 */
const STATUS_COLORS = {
    connected: '#4caf50',
    disconnected: '#f44336',
    connecting: '#ff9800',
    error: '#f44336'
};

class ConnectionSetup extends Component {
    constructor(props) {
        super(props);
        this.state = {
            url: props.config?.homeAssistant?.url || '',
            accessToken: props.config?.homeAssistant?.accessToken || '',
            testing: false,
            connecting: false,
            testResult: null,
            testMessage: null,
            showToken: false
        };
    }

    componentDidUpdate(prevProps) {
        if (prevProps.config !== this.props.config) {
            this.setState({
                url: this.props.config?.homeAssistant?.url || '',
                accessToken: this.props.config?.homeAssistant?.accessToken || ''
            });
        }
    }

    handleUrlChange = (event) => {
        this.setState({ url: event.target.value, testResult: null });
    };

    handleTokenChange = (event) => {
        this.setState({ accessToken: event.target.value, testResult: null });
    };

    toggleShowToken = () => {
        this.setState(state => ({ showToken: !state.showToken }));
    };

    handleTestConnection = async () => {
        this.setState({ testing: true, testResult: null });

        try {
            const result = await this.props.ipc.invoke('ha:testConnection', {
                url: this.state.url,
                accessToken: this.state.accessToken
            });

            this.setState({
                testing: false,
                testResult: result.success ? 'success' : 'error',
                testMessage: result.message
            });
        } catch (error) {
            this.setState({
                testing: false,
                testResult: 'error',
                testMessage: error.message
            });
        }
    };

    handleSave = async () => {
        const { url, accessToken } = this.state;

        this.setState({ connecting: true, testResult: null, testMessage: null });

        // Update configuration with credentials
        const newConfig = {
            ...this.props.config,
            homeAssistant: {
                ...this.props.config?.homeAssistant,
                url: url,
                accessToken: accessToken
            }
        };

        this.props.configurationUpdate(newConfig);

        // Trigger connection
        try {
            console.log('[HA ConnectionSetup] Calling ha:connect...');
            const result = await this.props.ipc.invoke('ha:connect', { url, accessToken });
            console.log('[HA ConnectionSetup] ha:connect result:', result);

            if (result && result.success) {
                this.setState({
                    connecting: false,
                    testResult: 'success',
                    testMessage: result.message || 'Connected successfully!'
                });
            } else {
                this.setState({
                    connecting: false,
                    testResult: 'error',
                    testMessage: result?.message || 'Connection failed'
                });
            }
        } catch (error) {
            console.error('[HA ConnectionSetup] Failed to connect:', error);
            this.setState({
                connecting: false,
                testResult: 'error',
                testMessage: error.message || 'Connection error'
            });
        }
    };

    handleDisconnect = async () => {
        try {
            const result = await this.props.ipc.invoke('ha:disconnect');
            if (result && result.success) {
                // Update configuration with disconnected status
                const newConfig = {
                    ...this.props.config,
                    connectionStatus: result.connectionStatus || {
                        connected: false,
                        authenticated: false
                    }
                };
                this.props.configurationUpdate(newConfig);
                this.setState({
                    testResult: null,
                    testMessage: null
                });
            }
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    };

    renderStatus() {
        const { connectionStatus } = this.props;
        if (!connectionStatus) return null;

        const statusColor = STATUS_COLORS[connectionStatus.status] || STATUS_COLORS.disconnected;

        return (
            <Box display="flex" alignItems="center" mb={2}>
                <Typography variant="body2" style={{ marginRight: 8 }}>
                    Status:
                </Typography>
                <Chip
                    size="small"
                    label={connectionStatus.status || 'Unknown'}
                    style={{
                        backgroundColor: statusColor,
                        color: 'white'
                    }}
                />
                {connectionStatus.authenticated && (
                    <Chip
                        size="small"
                        label="Authenticated"
                        style={{
                            marginLeft: 8,
                            backgroundColor: '#4caf50',
                            color: 'white'
                        }}
                    />
                )}
            </Box>
        );
    }

    render() {
        const { url, accessToken, testing, connecting, testResult, testMessage, showToken } = this.state;
        const { connectionStatus } = this.props;

        const isConnected = connectionStatus?.status === 'connected';
        const canSave = url && accessToken;
        const isLoading = testing || connecting;

        return (
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Home Assistant Connection
                    </Typography>

                    {this.renderStatus()}

                    <TextField
                        label="Home Assistant URL"
                        placeholder="http://homeassistant.local:8123"
                        value={url}
                        onChange={this.handleUrlChange}
                        fullWidth
                        margin="normal"
                        variant="outlined"
                        helperText="The URL of your Home Assistant instance"
                    />

                    <TextField
                        label="Long-Lived Access Token"
                        placeholder="eyJ0eXAiOiJKV1QiLCJhbGc..."
                        value={accessToken}
                        onChange={this.handleTokenChange}
                        type={showToken ? 'text' : 'password'}
                        fullWidth
                        margin="normal"
                        variant="outlined"
                        helperText="Create a token in Home Assistant: Profile > Long-Lived Access Tokens"
                        InputProps={{
                            endAdornment: (
                                <Button
                                    size="small"
                                    onClick={this.toggleShowToken}
                                    style={{ minWidth: 'auto' }}
                                >
                                    {showToken ? 'Hide' : 'Show'}
                                </Button>
                            )
                        }}
                    />

                    {testResult && (
                        <Box mt={2}>
                            <Typography
                                variant="body2"
                                style={{
                                    color: testResult === 'success' ? '#4caf50' : '#f44336'
                                }}
                            >
                                {testResult === 'success'
                                    ? 'Connection successful!'
                                    : `Connection failed: ${testMessage}`
                                }
                            </Typography>
                        </Box>
                    )}
                </CardContent>

                <CardActions>
                    <Button
                        variant="outlined"
                        onClick={this.handleTestConnection}
                        disabled={!url || !accessToken || isLoading}
                        style={{ marginRight: 8 }}
                    >
                        {testing ? (
                            <>
                                <CircularProgress size={20} style={{ marginRight: 8 }} />
                                Testing...
                            </>
                        ) : (
                            'Test Connection'
                        )}
                    </Button>

                    {!isConnected && (
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={this.handleSave}
                            disabled={!canSave || isLoading}
                        >
                            {connecting ? (
                                <>
                                    <CircularProgress size={20} style={{ marginRight: 8, color: 'white' }} />
                                    Connecting...
                                </>
                            ) : (
                                'Connect'
                            )}
                        </Button>
                    )}

                    {isConnected && (
                        <Button
                            variant="outlined"
                            color="secondary"
                            onClick={this.handleDisconnect}
                        >
                            Disconnect
                        </Button>
                    )}
                </CardActions>
            </Card>
        );
    }
}

export default ConnectionSetup;

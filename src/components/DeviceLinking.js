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
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Chip from '@material-ui/core/Chip';
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';

const LINK_TYPES = {
    exclusive: { label: 'Exclusive', description: 'Device belongs to one child' },
    shared: { label: 'Shared', description: 'Device shared by multiple children with time rules' },
    family: { label: 'Family', description: 'Family device, not tracked per child' }
};

const WEEKDAYS = [
    { value: 'mon', label: 'Mon' },
    { value: 'tue', label: 'Tue' },
    { value: 'wed', label: 'Wed' },
    { value: 'thu', label: 'Thu' },
    { value: 'fri', label: 'Fri' },
    { value: 'sat', label: 'Sat' },
    { value: 'sun', label: 'Sun' }
];

class DeviceLinking extends Component {
    constructor(props) {
        super(props);

        const existingLink = props.existingLink || {};

        this.state = {
            childId: existingLink.childId || '',
            linkType: existingLink.linkType || 'exclusive',
            usageRules: existingLink.usageRules || [],
            powerControlEnabled: !!existingLink.powerControl,
            powerControlEntityId: existingLink.powerControl?.entityId || '',
            gracePeriod: existingLink.powerControl?.gracePeriod || 60
        };
    }

    componentDidUpdate(prevProps) {
        if (prevProps.device !== this.props.device) {
            const existingLink = this.props.existingLink || {};
            this.setState({
                childId: existingLink.childId || '',
                linkType: existingLink.linkType || 'exclusive',
                usageRules: existingLink.usageRules || [],
                powerControlEnabled: !!existingLink.powerControl,
                powerControlEntityId: existingLink.powerControl?.entityId || '',
                gracePeriod: existingLink.powerControl?.gracePeriod || 60
            });
        }
    }

    handleChildChange = (event) => {
        this.setState({ childId: event.target.value });
    };

    handleLinkTypeChange = (event) => {
        this.setState({ linkType: event.target.value });
    };

    handlePowerControlToggle = (event) => {
        this.setState({ powerControlEnabled: event.target.checked });
    };

    handlePowerControlEntityChange = (event) => {
        this.setState({ powerControlEntityId: event.target.value });
    };

    handleGracePeriodChange = (event) => {
        this.setState({ gracePeriod: parseInt(event.target.value, 10) || 60 });
    };

    addUsageRule = () => {
        this.setState(state => ({
            usageRules: [
                ...state.usageRules,
                {
                    childId: '',
                    weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
                    timeRange: '15:00-21:00'
                }
            ]
        }));
    };

    removeUsageRule = (index) => {
        this.setState(state => ({
            usageRules: state.usageRules.filter((_, i) => i !== index)
        }));
    };

    updateUsageRule = (index, field, value) => {
        this.setState(state => {
            const rules = [...state.usageRules];
            rules[index] = { ...rules[index], [field]: value };
            return { usageRules: rules };
        });
    };

    toggleWeekday = (index, day) => {
        this.setState(state => {
            const rules = [...state.usageRules];
            const rule = { ...rules[index] };
            const weekdays = rule.weekdays || [];

            if (weekdays.includes(day)) {
                rule.weekdays = weekdays.filter(d => d !== day);
            } else {
                rule.weekdays = [...weekdays, day];
            }

            rules[index] = rule;
            return { usageRules: rules };
        });
    };

    handleSave = async () => {
        const { device } = this.props;
        const {
            childId,
            linkType,
            usageRules,
            powerControlEnabled,
            powerControlEntityId,
            gracePeriod
        } = this.state;

        const linkData = {
            entityId: device.entityId,
            deviceName: device.name,
            linkType,
            childId: linkType === 'exclusive' ? parseInt(childId, 10) : null,
            usageRules: linkType === 'shared' ? usageRules.map(rule => ({
                ...rule,
                childId: parseInt(rule.childId, 10)
            })) : [],
            powerControl: powerControlEnabled ? {
                entityId: powerControlEntityId,
                gracePeriod
            } : null
        };

        try {
            await this.props.ipc.invoke('ha:linkDevice', linkData);
            this.props.onClose();
        } catch (error) {
            console.error('Failed to link device:', error);
        }
    };

    renderUsageRules() {
        const { usageRules } = this.state;
        const { children } = this.props;
        const childList = children ? Object.values(children) : [];

        return (
            <Box mt={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">
                        Usage Rules
                    </Typography>
                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={this.addUsageRule}
                    >
                        Add Rule
                    </Button>
                </Box>

                {usageRules.map((rule, index) => (
                    <Box
                        key={index}
                        p={2}
                        mb={1}
                        style={{ backgroundColor: '#f5f5f5', borderRadius: 4 }}
                    >
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                            <Box flex={1}>
                                <FormControl fullWidth size="small" margin="dense">
                                    <InputLabel>Child</InputLabel>
                                    <Select
                                        value={rule.childId || ''}
                                        onChange={(e) => this.updateUsageRule(index, 'childId', e.target.value)}
                                    >
                                        {childList.map(child => (
                                            <MenuItem key={child.id} value={child.id}>
                                                {child.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <Box mt={1}>
                                    <Typography variant="caption">Days:</Typography>
                                    <Box display="flex" flexWrap="wrap" mt={0.5}>
                                        {WEEKDAYS.map(day => (
                                            <Chip
                                                key={day.value}
                                                size="small"
                                                label={day.label}
                                                onClick={() => this.toggleWeekday(index, day.value)}
                                                color={rule.weekdays?.includes(day.value) ? 'primary' : 'default'}
                                                style={{ marginRight: 4, marginBottom: 4 }}
                                            />
                                        ))}
                                    </Box>
                                </Box>

                                <TextField
                                    label="Time Range"
                                    placeholder="15:00-21:00"
                                    value={rule.timeRange || ''}
                                    onChange={(e) => this.updateUsageRule(index, 'timeRange', e.target.value)}
                                    size="small"
                                    margin="dense"
                                    helperText="Format: HH:MM-HH:MM"
                                />
                            </Box>

                            <IconButton
                                size="small"
                                onClick={() => this.removeUsageRule(index)}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Box>
                    </Box>
                ))}

                {usageRules.length === 0 && (
                    <Typography variant="body2" color="textSecondary">
                        No rules defined. Add rules to specify which child can use this device and when.
                    </Typography>
                )}
            </Box>
        );
    }

    renderPowerControl() {
        const { powerControlEnabled, powerControlEntityId, gracePeriod } = this.state;
        const { smartPlugs } = this.props;
        const plugList = smartPlugs ? Object.values(smartPlugs) : [];

        return (
            <Box mt={2}>
                <FormControlLabel
                    control={
                        <Switch
                            checked={powerControlEnabled}
                            onChange={this.handlePowerControlToggle}
                        />
                    }
                    label="Enable Power Control (Smart Plug)"
                />

                {powerControlEnabled && (
                    <Box mt={1}>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Smart Plug</InputLabel>
                            <Select
                                value={powerControlEntityId}
                                onChange={this.handlePowerControlEntityChange}
                            >
                                {plugList.map(plug => (
                                    <MenuItem key={plug.entityId} value={plug.entityId}>
                                        {plug.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            label="Grace Period (seconds)"
                            type="number"
                            value={gracePeriod}
                            onChange={this.handleGracePeriodChange}
                            fullWidth
                            margin="normal"
                            helperText="Warning time before cutting power"
                        />
                    </Box>
                )}
            </Box>
        );
    }

    render() {
        const { open, onClose, device, children } = this.props;
        const { childId, linkType } = this.state;

        if (!device) return null;

        const childList = children ? Object.values(children) : [];
        const canSave = linkType === 'family' ||
            (linkType === 'exclusive' && childId) ||
            (linkType === 'shared' && this.state.usageRules.length > 0);

        return (
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>
                    Link Device: {device.name}
                </DialogTitle>

                <DialogContent>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                        {device.entityId}
                    </Typography>

                    <FormControl fullWidth margin="normal">
                        <InputLabel>Link Type</InputLabel>
                        <Select
                            value={linkType}
                            onChange={this.handleLinkTypeChange}
                        >
                            {Object.entries(LINK_TYPES).map(([value, info]) => (
                                <MenuItem key={value} value={value}>
                                    <Box>
                                        <Typography variant="body1">{info.label}</Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            {info.description}
                                        </Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {linkType === 'exclusive' && (
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Child</InputLabel>
                            <Select
                                value={childId}
                                onChange={this.handleChildChange}
                            >
                                {childList.map(child => (
                                    <MenuItem key={child.id} value={child.id}>
                                        {child.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {linkType === 'shared' && this.renderUsageRules()}

                    {this.renderPowerControl()}
                </DialogContent>

                <DialogActions>
                    <Button onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={this.handleSave}
                        color="primary"
                        variant="contained"
                        disabled={!canSave}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default DeviceLinking;

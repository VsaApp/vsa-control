import React, {Component} from 'react';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import logo from './img/logo.png';
import './App.css';
import openSocket from 'socket.io-client';
import {setAppVersionsData, setTrackingChartData, setUserCountChartData} from './ChartData.js';

var LineChart = require("react-chartjs").Line;

class User extends Component {
    state = {
        open: false
    };

    render() {
        const date = new Date(this.props.lastSession);
        const lastSession = this.props.lastSession === undefined ? '-' : `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        return (
            <tr className="userRow">
                <td className="userValue">{this.props.index}</td>
                <td className="userValue" id="devicename">{this.props.device}</td>
                <td className="userValue">{lastSession}</td>
                <td className="userValue">{this.props.appVersion}</td>
                <td className="userValue">{this.props.os}</td>
                <td className="userValue" id="deviceid"><a href={'https://api.vsa.2bad2c0.de/tags/' + this.props.id}
                                                           rel="noopener noreferrer" target="_blank">{this.props.id}</a>
                </td>
            </tr>
        );
    }
}

class App extends Component {

    chartOptions = {};
    socket;
    chart;

    state = {
        timestamp: '-',
        userCount: '-',
        oldUserCount: '-',
        userCountToday: '-',
        appStartsToday: '-',
        newestVersion: ['-', '-'],
        oldestVersion: ['-', '-'],
        userPerDay: '-',
        countIncreaseAbsolut: '-',
        countIncrease: '-',
        currentAppVersions: {},
        expandedBugs: {}
    };

    constructor(props) {
        super(props);

        this.socket = openSocket(window.location.href);

        // Get the data:
        this.socket.on('newData', (data) => this.setState(data));

        // Get the charts data..

        this.socket.on('trackingChartData', (data) => setTrackingChartData(data, (trackingChartData) => this.setState({trackingChartData})));
        this.socket.on('userCountData', (data) => setUserCountChartData(data, (userCountData) => this.setState({userCountData})));
        this.socket.on('appVersionsData', (data) => setAppVersionsData(data, (appVersionsData) => this.setState({appVersionsData})));
        this.socket.emit('getData');
    }

    getChart(name, count) {
        var w = window.innerWidth;
        const charWidth = w / 2 < 500 ? w - 100 : w / 2 - 100;
        const charHeight = charWidth / 16 * 9;
        console.log(charWidth, charHeight);
        if (this.state[name] === undefined) return <p>Wait for data...</p>;
        return <LineChart
            id={name}
            data={this.state[name]}
            options={{datasetFill: true, scaleGridLineColor: "rgba(255,255,255,.05)",}}
            width={charWidth}
            height={charHeight}
        />
    }

    createVersionsTable = () => {
        //Inner loop to create children
        const versions = this.state.currentAppVersions;
        let cells = [];
        Object.keys(versions).forEach((version) => {
            cells.push(<div className="grid-item">{version}:</div>);
            cells.push(<div className="grid-item"><b className="Value">{versions[version]}</b></div>);
        });
        return cells;
    };

    createBugsButton = () => {
        const allBugs = this.state.bugs;
        if (allBugs === undefined) return <Button onClick={() => this.socket.emit('loadBugsVersions')}
                                                  variant="outlined" color="inherit">Load</Button>;
        return (
            <Button
                onClick={() => {
                    this.setState({bugs: undefined});
                }}
                variant="outlined"
                color="inherit">X
            </Button>);
    };

    createFullBugMsg(msg) {
        return <code>
            {msg.split('\n').map((msg) => <code>{msg}<br/></code>)}
        </code>
    }

    createBugsTable = () => {
        //Inner loop to create children
        const allBugs = this.state.bugs;
        if (allBugs === undefined) return <p></p>;
        return (<div className="BugDiv">
                {Object.keys(allBugs).map((version) => {
                    const bugs = allBugs[version];
                    return (<div className="category bugs">
                        <p>
                            <b>Version: {version} ({bugs === undefined ? '-' : bugs.length})</b>
                            <Button
                                onClick={() => {
                                    if (bugs === undefined) {
                                        this.socket.emit('loadBugsVersions');
                                    } else {
                                        this.state.bugs[version] = undefined;
                                        this.setState({});
                                    }
                                }}
                                variant="outlined"
                                className="cancelButton"
                                color="inherit">{bugs === undefined ? "Load" : "X"}
                            </Button>
                        </p>
                        {(bugs || []).map((bug) => {
                            if (bug === undefined) return <div></div>;
                            const isExpanded = this.state.expandedBugs[version] !== undefined && this.state.expandedBugs[version].includes(bug);
                            return (
                                <p>
                                    <Button
                                        onClick={() => {
                                            if (isExpanded) {
                                                delete this.state.expandedBugs[version];
                                            } else {
                                                if (this.state.expandedBugs[version] === undefined) this.state.expandedBugs[version] = [];
                                                this.state.expandedBugs[version].push(bug);
                                            }
                                            console.log('expanded', isExpanded);
                                            console.log('expanded', this.state.expandedBugs);
                                            this.setState({});
                                        }}
                                        variant="outlined"
                                        className="bugButton"
                                        color="inherit"
                                    >
                                        <div className="bug-container">
                                            <div className="bug-item">Count:</div>
                                            <div className="value">{bug.count}</div>
                                            <div className="bug-item">Users:</div>
                                            <div className="value">[{bug.ids.map((id) => <a
                                                href={"api.vsa.2bad2c0.de/tags/" + id}>{id}, </a>)}]
                                            </div>
                                            <div className="bug-item">Msg:</div>
                                            <div className="value">
                                                <code>{!isExpanded ? bug.msg.split('\n')[0] : this.createFullBugMsg(bug.msg)}</code>
                                            </div>
                                        </div>
                                    </Button>
                                    <IconButton
                                        variant="outlined"
                                        onClick={() => {
                                            this.state.bugs[version][bugs.indexOf(bug)] = undefined;
                                            this.setState({});
                                            this.socket.emit('removeBug', {version: version, bug: bug});
                                        }}
                                        aria-label="Delete"
                                        className="cancelButton">
                                        <DeleteIcon fontSize="large" color="primary"/>
                                    </IconButton>
                                </p>
                            );
                        })}
                    </div>);
                })}
            </div>
        );
    };

    createDevicesTable = (isDevice) => {
        //Inner loop to create children
        const devices = isDevice ? this.state.devices : this.state.users;
        if (devices === undefined) return <p><Button
            onClick={() => this.socket.emit(isDevice ? 'loadDevices' : 'loadUsers', 'lastSession')} variant="outlined"
            className="loadButton" color="inherit">Load</Button></p>;
        return (<table>
            <tr className="userRow">
                <td className="userValue"></td>
                <td className="userValue"><Button
                    onClick={() => this.socket.emit(isDevice ? 'loadDevices' : 'loadUsers', 'device')}
                    variant="outlined" className="loadButton" color="inherit"><b>Device</b></Button></td>
                <td className="userValue"><Button
                    onClick={() => this.socket.emit(isDevice ? 'loadDevices' : 'loadUsers', 'lastSession')}
                    variant="outlined" className="loadButton" color="inherit"><b>Last Session</b></Button></td>
                <td className="userValue"><Button
                    onClick={() => this.socket.emit(isDevice ? 'loadDevices' : 'loadUsers', 'appVersion')}
                    variant="outlined" className="loadButton" color="inherit"><b>App Version</b></Button></td>
                <td className="userValue"><Button
                    onClick={() => this.socket.emit(isDevice ? 'loadDevices' : 'loadUsers', 'os')} variant="outlined"
                    className="loadButton" color="inherit"><b>Os</b></Button></td>
                <td className="userValue"><Button
                    onClick={() => this.socket.emit(isDevice ? 'loadDevices' : 'loadUsers', 'id')} variant="outlined"
                    className="loadButton" color="inherit"><b>Device ID</b></Button></td>
            </tr>
            {devices.map((device) => <User index={devices.indexOf(device) + 1} device={device.tags.deviceName}
                                           lastSession={device.tags.lastSession} appVersion={device.tags.appVersion}
                                           os={device.tags.os} id={device.id} tags={device.tags.toString()}/>)}
        </table>);
    };

    getChartData(name) {
        return this.state[name] || {
            month: '',
            labels: [],
            datasets: {
                label: "",
                data: []
            }
        }
    }

    render() {
        return (
            <div className="App">
                <header className="App-header">
                    <h1>VsaControl</h1>
                    <img src={logo} className="App-logo" alt="logo"/>
                </header>
                <body>
                <div className="grid-container">
                    <div className="grid-item">Updated:</div>
                    <div className="grid-item"><b className="Value">{this.state.timestamp}</b></div>
                    <div className="grid-item"><a href="#devices">Current user count:</a></div>
                    <div className="grid-item"><b className="Value">{this.state.userCount}</b></div>
                    <div className="grid-item"><a href="#appStarts">App users today:</a></div>
                    <div className="grid-item"><b className="Value">{this.state.userCountToday}</b></div>
                    <div className="grid-item"><a href="#appStarts">App starts today: </a></div>
                    <div className="grid-item"><b
                        className="Value">{this.state.appStartsToday} ({this.state.userCountToday === 0 ? '0' : (this.state.appStartsToday / this.state.userCountToday)} /
                        User)</b></div>
                    <div className="grid-item"><a href="#tracking">Newest App Version: </a></div>
                    <div className="grid-item"><b
                        className="Value">{this.state.newestVersion[0]} ({this.state.newestVersion[1]} User)</b></div>
                    <div className="grid-item"><a href="#tracking">Oldest App Version: </a></div>
                    <div className="grid-item"><b
                        className="Value">{this.state.oldestVersion[0]} ({this.state.oldestVersion[1]} User)</b></div>
                </div>
                <h2>Stats</h2>
                <div id="tracking">
                    <div className="category" id="appStarts">
                        <div className="Chart">
                            <p>User per day ({this.getChartData('trackingChartData').month})</p>
                            {this.getChart('trackingChartData', 2)}
                        </div>
                        <div className="ChartInfo">
                            <p>Overview</p>
                            <div className="grid-container">
                                <div className="grid-item">App starts
                                    in {this.getChartData('trackingChartData').month}:
                                </div>
                                <div className="grid-item"><b className="Value">{this.state.appStartsPerUser}</b></div>
                                <div className="grid-item">Users per day
                                    in {this.getChartData('trackingChartData').month}</div>
                                <div className="grid-item"><b className="Value">{this.state.userPerDay}</b></div>
                                <div className="grid-item">App users today:</div>
                                <div className="grid-item"><b className="Value">{this.state.userCountToday || '-'}</b>
                                </div>
                                <div className="grid-item">App starts today:</div>
                                <div className="grid-item"><b
                                    className="Value">{this.state.appStartsToday || '-'} ({this.state.userCountToday === 0 ? '-' : this.state.appStartsToday / this.state.userCountToday} /
                                    User)</b></div>
                            </div>
                        </div>
                    </div>
                    <div className="category" id="appVersions">
                        <div className="Chart">
                            <p>App Versions ({this.getChartData('appVersionsData').month})</p>
                            {this.getChart('appVersionsData', Object.keys(this.state.currentAppVersions).length)}
                        </div>
                        <div className="ChartInfo">
                            <p>Overview</p>
                            <div className="grid-container">
                                {this.createVersionsTable()}
                            </div>
                        </div>
                    </div>
                    <div className="category" id="userCount">
                        <div className="Chart">
                            <p>User count history ({this.getChartData('userCountData').month})</p>
                            {this.getChart('userCountData', 1)}
                        </div>
                        <div className="ChartInfo">
                            <p>Overview </p>
                            <div className="grid-container">
                                <div className="grid-item">Current User Count:</div>
                                <div className="grid-item"><b className="Value">{this.state.userCount}</b></div>
                                <div className="grid-item">Zunahme:</div>
                                <div className="grid-item"><b className="Value">{this.state.countIncreaseAbsolut}</b>
                                </div>
                                <div className="grid-item">Zunahme in %:</div>
                                <div className="grid-item"><b className="Value">{this.state.countIncrease} %</b></div>
                            </div>
                        </div>
                    </div>
                </div>
                <h2>Devices</h2>
                <div id="devices" className="category users">
                    <p><b>Firebase users ({this.state.userCount})</b><Button
                        onClick={() => this.setState({devices: undefined})} variant="outlined" className="cancelButton"
                        color="inherit">X</Button></p>
                    {this.createDevicesTable(true)}
                </div>
                <div className="category users">
                    <p><b>Onesignal users ({this.state.oldUserCount})</b><Button
                        onClick={() => this.setState({users: undefined})} variant="outlined" className="cancelButton"
                        color="inherit">X</Button></p>
                    {this.createDevicesTable(false)}
                </div>
                <h2>Bugs {this.createBugsButton()}</h2>
                {this.createBugsTable()}
                </body>
            </div>
        );
    }
}

export default App;

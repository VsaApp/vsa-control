const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'config.json')).toString());

const analyseTags = (client) => {
    const file = path.resolve(config.apiPath, 'tags.json');
    if (fs.existsSync(file)) {
        data = JSON.parse(fs.readFileSync(file).toString());
        client.emit('newData', {userCount: data.devices.length, oldUserCount: data.users.length});
    }
};

const compaireDevices = (d1, d2, sort) => {
    if (sort === 'lastSession') {
        if (d1.tags.lastSession === undefined) return 1;
        if (d2.tags.lastSession === undefined) return -1;
        l1 = new Date(d1.tags.lastSession).getTime();
        l2 = new Date(d2.tags.lastSession).getTime();
        return l1 < l2 ? 1 : l1 == l2 ? 0 : -1;
    } else if (sort === 'appVersion') {
        if (d1.tags.appVersion === undefined) return 1;
        if (d2.tags.appVersion === undefined) return -1;
        v1 = parseInt(d1.tags.appVersion.split('+')[1]);
        v2 = parseInt(d2.tags.appVersion.split('+')[1]);
        return v1 < v2 ? 1 : v1 == v2 ? 0 : -1;
    } else if (sort === 'os') {
        if (d1.tags.os === undefined) return 1;
        if (d2.tags.os === undefined) return -1;
        if (d1.tags.os.split(' ')[0] !== d1.tags.os.split(' ')[0]) {
            return d1.tags.os.split(' ')[0] === 'Android' ? -1 : 1;
        }
        v1 = parseInt(d1.tags.os.split(' ')[1].split('.').join('').padStart(3, '0'));
        v2 = parseInt(d2.tags.os.split(' ')[1].split('.').join('').padStart(3, '0'));
        return v1 < v2 ? -1 : v1 == v2 ? 0 : 1;
    }
    return 1;
};

const sortDeviceNames = (devices, sort) => {
    const key = sort === 'device' ? 'deviceName' : 'os';
    const useKey = sort === 'device' || sort === 'os';
    const sortedNames = devices.filter((device) => {
        return (useKey ? device.tags[key] : device.id) !== undefined;
    }).map((device) => {
        return (useKey ? device.tags[key] : device.id);
    }).sort();
    const result = devices.sort((d1, d2) => {
        d1 = (useKey ? d1.tags[key] : d1.id);
        d2 = (useKey ? d2.tags[key] : d2.id);
        if (d1 === undefined) return sort === 'os' ? -1 : 1;
        if (d2 === undefined) return sort === 'os' ? 1 : -1;
        return sortedNames.indexOf(d1) < sortedNames.indexOf(d2) ? -1 : sortedNames.indexOf(d1) === sortedNames.indexOf(d2) ? 0 : 1;
    });

    return sort === 'os' ? result.reverse() : result;
};

const sendDevies = (client, sort) => {
    const file = path.resolve(config.apiPath, 'tags.json');
    if (fs.existsSync(file)) {
        data = JSON.parse(fs.readFileSync(file).toString()).devices;
        if (sort === 'device' || sort === 'id' || sort === 'os') data = sortDeviceNames(data, sort);
        else data = data.sort((d1, d2) => compaireDevices(d1, d2, sort));
        client.emit('newData', {devices: data});
    }
};

const sendUsers = (client, sort) => {
    const file = path.resolve(config.apiPath, 'tags.json');
    if (fs.existsSync(file)) {
        data = JSON.parse(fs.readFileSync(file).toString()).users;
        if (sort === 'device' || sort === 'id') data = sortDeviceNames(data);
        else data = data.sort((d1, d2) => compaireDevices(d1, d2, sort));
        client.emit('newData', {users: data});
    }
};

const analyseStats = (client) => {

    const file = path.resolve(config.apiPath, 'stats.json');
    if (fs.existsSync(file)) {
        const results = {};
        data = JSON.parse(fs.readFileSync(file).toString());

        if (data.appStarts === undefined) data.appStarts = {};
        if (data.users === undefined) data.users = {};
        if (data.userCount === undefined) data.userCount = {};
        if (data.appStarts === undefined) data.appVersions = {};

        // Send the count of users who used the app today
        usersToday = data.users[new Date().toDateString()] || [];
        results.userCountToday = usersToday.length;

        // Send the current app starts count of today
        startsToday = data.appStarts[new Date().toDateString()] || 0;
        results.appStartsToday = startsToday;

        // Send the app uses stats
        const days = {};
        const today = new Date();
        for (let i = 1; i <= today.getDate(); i++) {
            const day = new Date(today.getFullYear(), today.getMonth(), i).toDateString();
            days[day] = [0, 0];
            days[day][0] = data.appStarts[day] === undefined ? 0 : parseFloat((data.appStarts[day] / data.users[day].length).toFixed(1));
            days[day][1] = data.users[day] === undefined ? 0 : data.users[day].length;
        }
        client.emit('trackingChartData', days);

        // Send the average app useses data
        let usersPerTime = 0;
        let startsPerTime = 0;
        Object.keys(days).forEach((day) => {
            usersPerTime += days[day][1];
            startsPerTime += days[day][0];
        });
        results.userPerDay = parseFloat((usersPerTime / Object.keys(days).length).toFixed(1));
        results.appStartsPerUser = parseFloat((startsPerTime / Object.keys(days).length).toFixed(1));

        // Send the user count stats
        let lastCount = data.userCount[Object.keys(data.userCount)[0]];
        for (let i = 1; i <= today.getDate(); i++) {
            const day = new Date(today.getFullYear(), today.getMonth(), i).toDateString();
            if (data.userCount[day] !== undefined) lastCount = data.userCount[day];
            days[day] = data.userCount[day] === undefined ? lastCount : data.userCount[day];
        }
        client.emit('userCountData', days);
        const end = days[Object.keys(days)[Object.keys(days).length - 1]];
        const start = days[Object.keys(days)[0]];
        results.countIncrease = ((end - start) / start * 100).toFixed(1);
        results.countIncreaseAbsolut = end - start;

        // Send the newest and oldest version
        const currentAppVersions = data.appVersions[Object.keys(data.appVersions)[Object.keys(data.appVersions).length - 1]];
        results.currentAppVersions = currentAppVersions;
        results.newestVersion = [Object.keys(currentAppVersions)[0], currentAppVersions[Object.keys(currentAppVersions)[0]]];
        results.oldestVersion = [Object.keys(currentAppVersions)[Object.keys(currentAppVersions).length - 1], currentAppVersions[Object.keys(currentAppVersions)[Object.keys(currentAppVersions).length - 1]]];

        // Send the versions stats
        let lastStats = data.appVersions[Object.keys(data.appVersions)[0]];
        for (let i = 1; i <= today.getDate(); i++) {
            const day = new Date(today.getFullYear(), today.getMonth(), i).toDateString();
            if (data.appVersions[day] !== undefined) lastStats = data.appVersions[day];
            days[day] = data.appVersions[day] === undefined ? lastStats : data.appVersions[day];
        }
        client.emit('appVersionsData', days);

        // Send all available months and years
        const months = [];
        const years = [];
        Object.keys(data.appStarts).forEach((day) => {
            const year = day.split(' ')[3];
            const month = day.split(' ')[1];
            if (!years.includes(year)) years.push(year);
            if (!months.includes(month)) months.push(month);
        });
        results.availableMonths = months;
        results.availableYears = years;

        client.emit('newData', results);
    }
};

const removeBug = (value) => {
    const file = path.resolve(config.apiPath, 'bugs.json');
    if (fs.existsSync(file)) {
        let data = JSON.parse(fs.readFileSync(file).toString());

        let index = -1;
        data[value.version].forEach((bug) => {
            if (JSON.stringify(bug) === JSON.stringify(value.bug)) index = data[value.version].indexOf(bug);
        });
        data[value.version] = data[value.version].filter((bug) => data[value.version].indexOf(bug) != index);
        if (data[value.version].length == 0) {
            const newData = {};
            Object.keys(data).filter((version) => version != value.version).forEach((version) => newData[version] = data[version]);
            data = newData;
        }

        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
};

const sendBugs = (client) => {
    const file = path.resolve(config.apiPath, 'bugs.json');
    if (fs.existsSync(file)) {
        const results = {};
        let data = JSON.parse(fs.readFileSync(file).toString());

        const sortedKeys = Object.keys(data).sort((v1, v2) => {
            if (v1 === 'UNDEFINED') return 1;
            if (v2 === 'UNDEFINED') return -1;
            v1 = parseInt(v1.split('+')[1]);
            v2 = parseInt(v2.split('+')[1]);

            return v1 < v2 ? -1 : v1 === v2 ? 0 : 1;
        });

        results.bugs = {};
        sortedKeys.forEach((key) => results.bugs[key] = data[key].reverse());

        client.emit('newData', results);
    }
};

io.on('connection', (client) => {
    console.log('New client connection');
    client.on('getData', () => {
        client.emit('newData', {timestamp: new Date()});
        analyseTags(client);
        analyseStats(client);
    });

    client.on('loadBugs', () => {
        sendBugs(client);
    });

    client.on('loadDevices', (sort) => sendDevies(client, sort));
    client.on('loadUsers', (sort) => sendUsers(client, sort));
    client.on('loadBugsVersions', () => sendBugs(client));
    client.on('removeBug', (value) => removeBug(value));
});

app.use(express.static('build'));

const port = process.env.PORT || 8000;

server.listen(port, () => {
    console.log('listening on port ', port);
});
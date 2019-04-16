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
        client.emit('newData', {userCount: data.devices.length});
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
    const key = sort === 'device' ? 'deviceName' : sort;
    const useKey = sort !== 'id';
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

    return ['os', 'grade', 'dev'].includes(sort) ? result.reverse() : result;
};

const sendDevices = (client, sort) => {
    const file = path.resolve(config.apiPath, 'tags.json');
    if (fs.existsSync(file)) {
        data = JSON.parse(fs.readFileSync(file).toString()).devices;
        if (['os', 'device', 'id', 'dev', 'grade'].includes(sort)) data = sortDeviceNames(data, sort);
        else data = data.sort((d1, d2) => compaireDevices(d1, d2, sort));
        client.emit('newData', {devices: data});
    }
};

const forDaysInSpace = (days, space, cB) => {
    const dayInMillis = 1000 * 60 * 60 * 24; 
    const today = new Date();
    let spaceName;
    let step = 1;
    let stepsInDays = true;
    let start;
    let end;
    if (space === 'current') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
        if (end.getTime() > today.getTime()) end = today;
        spaceName = start.toDateString().split(' ')[1];
    }
    else if (space.split(' ').length === 2 && space.length === 8) {
        const year = space.split(' ')[1];
        const month = space.split(' ')[0];
        start = new Date(`${month} 1, ${year}`);
        end = new Date(new Date(start.getFullYear(), start.getMonth() + 1, 1) - dayInMillis);
        if (end.getMonth() === today.getMonth()) {
            if (end.getTime() > today.getTime()) end = today;
        }
        spaceName = start.toDateString().split(' ')[1];
    }
    else if (space.length === 4) {
        start = new Date(parseInt(space), 0, 1);
        end = new Date(new Date(parseInt(space) + 1, 0, 1) - dayInMillis);
        stepsInDays = false;
        if (end.getFullYear() === today.getFullYear()) {
            //if (end.getTime() > today.getTime()) end = today;
        }
        spaceName = start.getFullYear().toString();
    }
    else if (space === 'all') {
        start = new Date(Object.keys(days)[0]);
        end = new Date(Object.keys(days)[Object.keys(days).length - 1]);
        const diffInDays = (end.getTime() - start.getTime()) / dayInMillis;
        if (diffInDays > 450) stepsInDays = false;
        if (diffInDays > 15 && stepsInDays) step =  parseInt(diffInDays / 15);
        spaceName = 'All';
    }
    

    const diffInDays = (end.getTime() - start.getTime()) / dayInMillis;
    for (let i = 0; i <= diffInDays; i += step) {
        const day = new Date(start.getTime() + i * dayInMillis);
        if (stepsInDays) {
            const label = spaceName !== 'All' ? day.getDate().toString() : day.getDate().toString() + ' ' + day.toDateString().split(' ')[1];
            cB(day.toDateString(), label);
        }
        else {
            const isLastDayInMonth = day.getMonth() != new Date(day.getTime() + dayInMillis).getMonth();
            if (isLastDayInMonth) cB(day.toDateString(), day.toDateString().split(' ')[1]);
        }
    }

    return spaceName;
};

const getPreviousValue = (days, day, defaultValue) => {
    const keys = Object.keys(days);
    const firstDay = new Date(keys[0]);
    if (firstDay.getTime() > day.getTime()) return defaultValue;
    for (let i = keys.length - 1; i >= 0; i--) {
        if (new Date(keys[i]).getTime() < day.getTime()) return days[keys[i]];
    }
} 

const analyseStats = (client, space) => {

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
        let days = {};
        labels = [];
        let spaceName = forDaysInSpace(data.appStarts, space, (day, label) => {
            labels.push(label);
            days[day] = [0, 0];
            // Show for month or day...
            if (label.length === 3) {
                const users = [];
                let allAppStarts = 0;
                forDaysInSpace(data.appStarts, `${day.split(' ')[1]} ${day.split(' ')[3]}`, (day, label) => {
                    allAppStarts += data.appStarts[day] || 0;
                    (data.users[day] || []).forEach((user) => {
                        if (!users.includes(user)) users.push(user);
                    });
                });
                days[day][0] = parseFloat((users.length !== 0 ? allAppStarts / users.length : 0).toFixed(1));
                days[day][1] = users.length;
            }
            else {
                days[day][0] = data.appStarts[day] === undefined ? 0 : parseFloat((data.appStarts[day] / data.users[day].length).toFixed(1));
                days[day][1] = data.users[day] === undefined ? 0 : data.users[day].length;
            }
        });
        client.emit('trackingChartData', [labels, days, spaceName]);

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
        days = {};
        labels = [];
        spaceName = forDaysInSpace(data.userCount, space, (day, label) => {
            labels.push(label);
            days[day] = data.userCount[day] !== undefined ? data.userCount[day] : getPreviousValue(data.userCount, new Date(day), 0);
        });
        client.emit('userCountData', [labels, days, spaceName]);
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
        labels = [];
        days = {};
        spaceName = forDaysInSpace(data.appVersions, space, (day, label) => {
            labels.push(label);
            days[day] = data.appVersions[day] !== undefined ? data.appVersions[day] : getPreviousValue(data.appVersions, new Date(day), {});
        });
        client.emit('appVersionsData', [labels, days, spaceName]);

        // Send all available months and years
        const months = ['current'];
        const years = ['current'];
        Object.keys(data.appStarts).forEach((day) => {
            const year = day.split(' ')[3];
            const month = day.split(' ')[1] + ' ' + year;
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

            return v1 < v2 ? 1 : v1 === v2 ? 0 : -1;
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
        analyseStats(client, 'current');
    });

    client.on('loadBugs', () => sendBugs(client));
    client.on('loadDevices', (sort) => sendDevices(client, sort));
    client.on('loadBugsVersions', () => sendBugs(client));
    client.on('removeBug', (value) => removeBug(value));
    client.on('setTimeSpace', (space) => analyseStats(client, space));
});

app.use(express.static('build'));

const port = process.env.PORT || 8000;

server.listen(port, () => {
    console.log('listening on port ', port);
});
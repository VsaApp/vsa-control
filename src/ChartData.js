export const setAppVersionsData = (days, cB) => {
    const allVersions = [];
    Object.keys(days).forEach((day) => Object.keys(days[day]).forEach((version) => {
        if (!allVersions.includes(version)) allVersions.push(version);
    }));
    cB({
        month: Object.keys(days)[0].split(' ')[1],
        labels: Object.keys(days).map((day) => day.split(' ')[2]),
        datasets: allVersions.map((version) => {
            const index = allVersions.length - allVersions.indexOf(version);
            return {
                label: version,
                fillColor: index % 2 === 0 ? "#50a932a0" : "#ffffff30",
                strokeColor: index % 2 === 0 ? "#50a932" : "#fff",
                pointColor: index % 2 === 0 ? "#50a932" : "#fff",
                pointStrokeColor: index % 2 === 0 ? "#50a932" : "#fff",
                pointHighlightFill: index % 2 === 0 ? "#50a932" : "#fff",
                pointHighlightStroke: index % 2 === 0 ? "rgba(220,220,220,1)" : "rgba(151,187,205,1)",
                data: Object.keys(days).map((day) => {
                    if (days[day][version] === undefined) return 0;
                    return days[day][version];
                })
            };
        })
    });
}

export const setUserCountChartData = (days, cB) => {
    cB({
        month: Object.keys(days)[0].split(' ')[1],
        labels: Object.keys(days).map((day) => day.split(' ')[2]),
        datasets: [
          {
            label: "Users count history",
            fillColor: "#50a932a0",
            strokeColor: "#50a932",
            pointColor: "#50a932",
            pointStrokeColor: "#50a932",
            pointHighlightFill: "#50a932",
            pointHighlightStroke: "rgba(220,220,220,1)",
            data: Object.keys(days).map((day) => days[day])
          },
        ]
    });
}
    

export const setTrackingChartData = (days, cB) => {
    cB({
    month: Object.keys(days)[0].split(' ')[1],
    labels: Object.keys(days).map((day) => day.split(' ')[2]),
    datasets: [
      {
        label: "Users per day",
        fillColor: "#50a932a0",
        strokeColor: "#50a932",
        pointColor: "#50a932",
        pointStrokeColor: "#50a932",
        pointHighlightFill: "#50a932",
        pointHighlightStroke: "rgba(220,220,220,1)",
        data: Object.keys(days).map((day) => days[day][1])
      },
      {
        label: "App starts per user",
        fillColor: "#ffffff30",
        strokeColor: "#fff",
        pointColor: "#fff",
        pointStrokeColor: "#fff",
        pointHighlightFill: "#fff",
        pointHighlightStroke: "rgba(151,187,205,1)",
        data: Object.keys(days).map((day) => days[day][0])
      }
    ]
  });
}
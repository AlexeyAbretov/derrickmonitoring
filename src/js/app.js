const internalFetch = (url, options) => {
    const fetchOptions = { ...options } || {};
    fetchOptions.credentials = 'same-origin';
    fetchOptions.headers = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    };

    fetchOptions.method = fetchOptions.method || 'POST';

    if (fetchOptions.body && typeof (fetchOptions.body) !== 'string') {
        fetchOptions.body = JSON.stringify(fetchOptions.body);
    }

    return fetch(url, fetchOptions)
        .then((response) => {
            if (response.status >= 400) {
                return {};
            }
            return response.json();
        })
        .catch((err) => {
            console.log(err);
            return {};
        });
};

let itemsById = {};

internalFetch('http://95.163.251.187/api/v1/tag/hierarchy', {
    method: 'GET'
}).then((response) => {
    const prepareData = function processItems(data = [], tag) {
        return data.map(x => {
            const hierarchy = x.hierarchy ?
                processItems(
                    Array.isArray(x.hierarchy) ?
                        x.hierarchy :
                        [x.hierarchy],
                    tag ? `${tag}.${x.tag}` : x.tag) :
                null;

            itemsById[x.tag || 'tag0'] = hierarchy;

            return {
                tag: x.tag || 'tag0',
                fullTag: tag ? `${tag}.${x.tag}` : '',
                description: x.description || 'Месторождения',
                itemLevel: x.level,
                hierarchy
            }
        });
    };

    const data = prepareData(response || [], null);

    var dataSource = new kendo.data.HierarchicalDataSource({
        data: data,
        schema: {
            model: {
                children: "hierarchy",
                id: 'tag'
            }
        }
    });

    $("#treeview-left").kendoTreeView({
        dataSource,
        dataTextField: ["description"],
        change: function (e) {
            renderTagChart();
        }
    });

    renderDashboardCharts();
});

$("#vertical").kendoSplitter({
    panes: [
        { collapsible: false, size: "20%" },
        { collapsible: false },
    ]
});

$("#chartType").kendoDropDownList();
$("#date").kendoDropDownList();
$("#period").kendoDropDownList();

$("#refresh").kendoButton({
    click: function (e) {
        renderDashboardCharts();
    }
});

$("#alerts").kendoButton({
    click: function (e) {
        renderAlerts();
    }
});

function renderAlerts() {
    var { tag } = getParams();

    var data = getTagAlerts(tag);

    data.then((x) => {
        const alerts = x.map(w => ({
            id: w.rule_id,
            rule: w.rule,
            bDate: new Date(w.time_begin).toLocaleFormat('%d.%m.%Y %H:%M:%S'),
            eDate: new Date(w.time_end).toLocaleFormat('%d.%m.%Y %H:%M:%S'),
            val: w.count
        }));

        $("#alertsGrid").kendoGrid({
            dataSource: {
                data: alerts,
                schema: {
                    model: {
                        fields: {
                            id: { type: "number" },
                            rule: { type: "string" },
                            bDate: { type: "string" },
                            eDate: { type: "string" },
                            val: { type: "number" }
                        }
                    }
                },
                pageSize: 20
            },
            scrollable: true,
            sortable: true,
            filterable: true,
            pageable: {
                input: true,
                numeric: false
            },
            columns: [
                { field: "id", title: "Номер" },
                { field: "rule", title: "Правило" },
                { field: "bDate", title: "Дата начала" },
                { field: "eDate", title: "Дата окончания" },
                { field: "val", title: "Последнее значение" }
            ]
        });

        $("#alertsWindow").kendoWindow({
            title: "Журнал событий",
            visible: false,
            actions: [
                "Minimize",
                "Maximize",
                "Close"
            ],
        }).data("kendoWindow").center().open();
    });
}

var chart1 = [
    'WQ2_0151_12_106_09.Well191.ESP.Status_Local',
    'WQ2_0151_12_106_09.Well191.ESP.Underload_SP',
    'WQ2_0151_12_106_09.Well191.ESP.Status_LastShutdownReason',
    'WQ2_0151_12_106_09.Well191.ESP.HIDCPassiveCurrentLeakage_Enable'
];

var chart2 = [
    'WQ2_0151_12_106_09.Well191.Well.IPM_WaterRate_Std',
    'WQ2_0151_12_106_09.Well191.Well.PIC004_CV',
    'WQ2_0151_12_106_09.Well191.Well.WellTest_EndTime'
];

var chart3 = [
    'WQ2_0151_12_106_09.Well191.Well.IPM_OilRate_Std'
];

function renderDashboardCharts() {
    let { type, period, from, to } = getParams();

    renderDashboardChart('chart1', type, period, from, to);
    renderDashboardChart('chart2', type, period, from, to);
    renderDashboardChart('chart3', type, period, from, to);
}

function renderDashboardChart(name, type, period, from, to) {
    Promise
        .all(window[name].map(x => getTagData(x, period, from, to)))
        .then(responses => {
            let series = [];
            let categories = [];

            responses.forEach(x => {
                const data = ((x || {}).data || []);

                data.forEach(d => {
                    const t = new Date(d.time).toLocaleFormat('%d.%m.%Y %H:%M:%S');
                    if (categories.indexOf(t) == -1) {
                        categories.push(t);
                    }
                });
            });

            categories = categories.sort((a, b) => a - b);

            responses.forEach((x, index) => {
                const data = ((x || {}).data || []).sort((a, b) => a.time - b.time);

                series.push({
                    name: window[name][index],
                    data: []
                });

                categories.forEach(c => {
                    const r = data.filter(d => new Date(d.time)
                        .toLocaleFormat('%d.%m.%Y %H:%M:%S') === c);
                    if (r.length) {
                        series[series.length - 1].data.push(r[0].value);
                    } else {
                        series[series.length - 1].data.push(null);
                    }
                });
            });

            createChat(
                `#${name}`,
                type.toLowerCase(),
                series,
                categories);
        });
}

function renderTagChart() {
    let { tag, level, id } = getParams();

    if (level === 4) {
        let to = parseInt((Date.now() / 1000).toFixed(0)) * 1000;
        let from = new Date();
        let offset = 24;
        from = parseInt((from.setHours(from.getHours() - offset) / 1000).toFixed(0)) * 1000;

        let data = getTagData(tag, '1m', from, to);

        data.then((x) => {
            const chartData = prepareChartData((x || {}).data || []);

            createChat(
                "#chart",
                'line',
                [{
                    name: tag,
                    data: chartData.data
                }],
                chartData.categories);

            $("#chartWindow").kendoWindow({
                width: '100%',
                title: "График",
                visible: false,
                actions: [
                    "Minimize",
                    "Maximize",
                    "Close"
                ],
            }).data("kendoWindow").center().open();
        });
    } else if (level === 2 || level === 3) {
        let tags = level === 3 ?
            itemsById[id].map(x => ({
                title: x.description
            })) :
            [];

        if (level === 2) {
            itemsById[id].forEach(x =>
                tags = tags.concat(x.hierarchy.map(z => ({
                    title: z.description
                })))
            )
        }

        $("#tagsGrid").kendoGrid({
            dataSource: {
                data: tags,
                schema: {
                    model: {
                        fields: {
                            title: { type: "string" }
                        }
                    }
                },
                pageSize: 20
            },
            scrollable: true,
            sortable: true,
            filterable: true,
            pageable: {
                input: true,
                numeric: false
            },
            columns: [
                { field: "title", title: "Название" },
            ]
        });

        $("#tagsWindow").kendoWindow({
            title: "Показатели",
            visible: false,
            actions: [
                "Minimize",
                "Maximize",
                "Close"
            ],
        }).data("kendoWindow").center().open();
    }
}

function prepareChartData(data = []) {
    const result = {
        data: [],
        categories: []
    };

    data = data.sort((a, b) => a.time - b.time);

    data.forEach((x, index) => {
        const v = x.value;
        const t = x.time;

        const date = new Date(t).toLocaleFormat('%d.%m.%Y %H:%M:%S');

        if (result.categories.indexOf(date) == -1) {
            result.categories.push(date);
            result.data.push(v);
        }
    });

    return result;
}

function getTagData(tag, period, from, to) {
    return internalFetch(`http://95.163.251.187/api/v1/data?tag=${tag}&period=${period}&from_ts=${from}&to_ts=${to}`, {
        method: 'GET'
    })
}

function getTagAlerts(tag) {
    return internalFetch(`http://95.163.251.187/api/v1/alerts?tag=${tag}`, {
        method: 'GET'
    })
}

function getParams() {
    const tv = $('#treeview-left')
        .data('kendoTreeView');
    const selected = tv
        .select();

    const data = tv.dataItem(selected);

    const tag = (data || {}).fullTag;
    const id = (data || {}).id;
    const level = (data || {}).itemLevel;

    const period = $("#period").data("kendoDropDownList").value();
    const type = $("#chartType").data("kendoDropDownList").value();
    const date = $("#date").data("kendoDropDownList").value();

    let to = parseInt((Date.now() / 1000).toFixed(0)) * 1000;
    let from = new Date();

    let offset = 1;

    switch (date) {
        case '8h':
            offset = 8;
            break;
        case '12h':
            offset = 12;
            break;
        case '24h':
            offset = 24;
            break;
        case '3d':
            offset = 24 * 3;
            break;
        case '1w':
            offset = 24 * 7;
            break;
        case '1h':
        default:
            offset = 1;
            break;
    }
    from = parseInt((from.setHours(from.getHours() - offset) / 1000).toFixed(0)) * 1000;

    return {
        tag,
        period,
        type,
        level,
        id,
        to,
        from
    }
}

function createChat(id, type = 'line', series = [{ name: 'main', data: [] }], categories = []) {
    $(id).kendoChart({
        title: {
            text: "Chart"
        },
        legend: {
            position: "bottom"
        },
        chartArea: {
            background: ""
        },
        seriesDefaults: {
            type: type === 'bar' ? 'column' : type,
            style: "smooth"
        },
        series: series,
        valueAxis: {
            labels: {
                format: "{0}"
            },
            line: {
                visible: false
            },
            axisCrossingValue: [-1e6, -1e6]
        },
        categoryAxis: {
            categories,
            majorGridLines: {
                visible: false
            },
            labels: {
                rotation: "auto"
            }
        },
        tooltip: {
            visible: true,
            format: "{0}%",
            template: "#= series.name #: #= value #"
        }
    });
}

if (!Date.prototype.toLocaleFormat) {
    Date.prototype.toLocaleFormat = function (format) {
        var f = {
            Y: this.getFullYear(),
            y: this.getFullYear() - (this.getFullYear() >= 2e3 ? 2e3 : 1900),
            m: this.getMonth() + 1,
            d: this.getDate(),
            H: this.getHours(),
            M: this.getMinutes(),
            S: this.getSeconds()
        }, k;
        for (k in f)
            format = format.replace('%' + k, f[k] < 10 ? "0" + f[k] : f[k]);
        return format;
    }
}
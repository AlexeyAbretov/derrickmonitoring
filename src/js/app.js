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

let treeData = null;
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

    treeData = prepareData(response || [], null);

    var dataSource = new kendo.data.HierarchicalDataSource({
        data: treeData,
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
            renderData();
        }
    });

    $("#chartType").kendoDropDownList({
        index: 0,
        change: function (e) {
            renderData();
        }
    });

    $("#period").kendoDropDownList({
        index: 0,
        change: function (e) {
            renderData();
        }
    });

    $("#refresh").kendoButton({
        click: function (e) {
            renderData();
        }
    });

    $("#alerts").kendoButton({
        click: function (e) {
            renderAlerts();
        }
    });
});

function renderAlerts() {
    // $("#tagAlerts").text('');

    var { tag } = getParams();

    var data = getTagAlerts(tag);

    data.then((x) => {
        // $("#tagAlerts").text(JSON.stringify(x));

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

function renderData() {
    let { tag, period, type, level, id } = getParams();

    if (level === 4) {
        let data = getTagData(tag, period);

        data.then((x) => {
            const chartData = prepareChartData((x || {}).data || []);

            createChat(type.toLowerCase(), chartData.data, chartData.categories);

            // $("#tagData").text(JSON.stringify(x));
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

    data.forEach((x, index) => {
        const v = x.value;
        const t = x.time;

        const date = new Date(t).toLocaleFormat('%d.%m.%Y %H:%M:%S')

        if (result.categories.indexOf(date) == -1 &&
            v >= 0) {
            result.categories.push(date);
            result.data.push(v);
        }
    })

    return result;
}

function getTagData(tag, period) {
    return internalFetch(`http://95.163.251.187/api/v1/data?tag=${tag}&preriod=${period}`, {
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

    const periodList = $("#period").data("kendoDropDownList");
    const period = periodList.value();

    const chartTypeList = $("#chartType").data("kendoDropDownList");
    const type = chartTypeList.value();

    return {
        tag,
        period,
        type,
        level,
        id
    }
}

function createChat(type = 'line', data = [], categories = []) {
    $("#chart").kendoChart({
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
        series: [{
            name: "main",
            data
        }],
        valueAxis: {
            labels: {
                format: "{0}"
            },
            line: {
                visible: false
            },
            axisCrossingValue: -10
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

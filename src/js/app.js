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

internalFetch('http://95.163.251.187/api/v1/tag/hierarchy', {
    method: 'GET'
}).then((response) => {
    const prepareData = function processItems(data = [], tag) {
        return data.map(x => ({
            tag: x.tag || 'tag0',
            fullTag: tag ? `${tag}.${x.tag}` : '',
            description: x.description || 'Показатели',
            hierarchy: x.hierarchy ?
                processItems(
                    Array.isArray(x.hierarchy) ?
                        x.hierarchy :
                        [x.hierarchy],
                    tag ? `${tag}.${x.tag}` : x.tag) :
                null
        }));
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
            renderChart();
        }
    });

    $("#chartType").kendoDropDownList({
        index: 0,
        change: function (e) {
            renderChart();
        }
    });
    $("#period").kendoDropDownList({
        index: 0,
        change: function (e) {
            renderChart();
        }
    });
});

function renderChart() {
    var { tag, period, type } = getParams();

    var data = getTagData(tag, period);

    data.then((x) => {
        const chartData = prepareChartData((x || {}).data || []);

        createChat(type.toLowerCase(), chartData.data, chartData.categories);

        $("#tagData").text(JSON.stringify(x))
    });
}

function prepareChartData(data = []) {
    const result = {
        data: [],
        categories: []
    };

    data.forEach((x, index) => {

        // if (index >= 400){
        //     return true;
        // }

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

function getParams() {
    const tv = $('#treeview-left')
        .data('kendoTreeView');
    const selected = tv
        .select();

    const data = tv.dataItem(selected);

    const tag = (data || {}).fullTag;

    const periodList = $("#period").data("kendoDropDownList");
    const period = periodList.value();

    const chartTypeList = $("#chartType").data("kendoDropDownList");
    const type = chartTypeList.value();

    return {
        tag,
        period,
        type
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

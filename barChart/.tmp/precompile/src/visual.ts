/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */
import DataViewObjects = powerbi.extensibility.utils.dataview.DataViewObjects;

module powerbi.extensibility.visual.barChartBC80E870F53F457F81A8959510AC6A85  {

    interface DataPoint {
        category: string;
        value: number;
        colour: string;
        identity: powerbi.visuals.ISelectionId;
        highlighted: boolean;
        tooltips: VisualTooltipDataItem[];
    };

    interface ViewModel {
        dataPoints: DataPoint[];
        maxValue: number;
        highlights: boolean;
        average: number;
    };

    export class Visual implements IVisual {

        private host: IVisualHost;
        private svg: d3.Selection<SVGElement>;
        private barGroup: d3.Selection<SVGElement>;
        private xPadding: number = 0.1;
        private selectionManager: ISelectionManager;
        private xAxisGroup: d3.Selection<SVGElement>;
        private yAxisGroup: d3.Selection<SVGElement>;
        private viewModel: ViewModel;

        private settings = {
            axis: {
                x: {
                    padding: {
                        default: 50,
                        value: 50
                    },
                    show: {
                        default: true,
                        value: true
                    }
                },
                y: {
                    padding: {
                        default: 50,
                        value: 50
                    },
                    show: {
                        default: true,
                        value: true
                    }
                }
            },
            border: {
                top: {
                    default: 10,
                    value: 10
                }
            }
        }

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;

            this.svg = d3.select(options.element)
                .append("svg")
                .classed("my-little-bar-chart", true);

            this.barGroup = this.svg
                .append("g")
                .classed("bar-group", true);

            this.xAxisGroup = this.svg.append("g")
                .classed("x-axis", true);
            
            this.yAxisGroup = this.svg.append("g")
                .classed("y-axis", true);
            
            this.selectionManager = this.host.createSelectionManager();
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];

            switch(objectName) {
                case 'xAxis':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.settings.axis.x.show.value,
                        },
                        selector: null
                    });
                    break;
                case 'yAxis':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.settings.axis.y.show.value,
                        },
                        selector: null
                    });
                    break;
                case 'dataColors':
                    if(this.viewModel) {
                        for(let dp of this.viewModel.dataPoints) {
                            objectEnumeration.push({
                                objectName: objectName,
                                displayName: dp.category,
                                properties: {
                                    fill: dp.colour,
                                },
                                selector: dp.identity.getSelector()
                            });
                        }
                    }
                    break;
            };

            return objectEnumeration;
        }

        public update(options: VisualUpdateOptions) {
            this.updateSettings(options);

            this.viewModel = this.getViewModel(options);

            let width = options.viewport.width;
            let height = options.viewport.height;
            
            let xAxisPadding = this.settings.axis.x.show.value ? this.settings.axis.x.padding.value : 0;
            let yAxisPadding = this.settings.axis.y.show.value ? this.settings.axis.y.padding.value : 0;

            this.svg.attr({
                width: width,
                height: height
            });

            let yScale = d3.scale.linear()
                .domain([0, this.viewModel.maxValue])
                .range([height - xAxisPadding, 0 + this.settings.border.top.value]);
            
            let yAxis = d3.svg.axis()
                .scale(yScale)
                .orient("left")
                .tickSize(1);
            
            this.yAxisGroup
                .call(yAxis)
                .attr({
                    transform: `translate(${yAxisPadding},0)`
                })
                .style({
                    fill: "#777777"
                })
                .selectAll("text")
                .style({
                    "text-anchor": "end",
                    "font-size": "x-small"
                });

            let xScale = d3.scale.ordinal()
                .domain(this.viewModel.dataPoints.map(d => d.category))
                .rangeRoundBands([yAxisPadding, width], this.xPadding);
            
            let xAxis = d3.svg.axis()
                .scale(xScale)
                .orient("bottom")
                .tickSize(1);

            this.xAxisGroup
                .call(xAxis)
                .attr({
                    transform: `translate(0,${height - xAxisPadding})`
                })
                .style({
                    fill: "#777777"
                })
                .selectAll("text")
                .attr({
                    transform: "rotate(-35)"
                })
                .style({
                    "text-anchor": "end",
                    "font-size": "x-small"
                });

            let bars = this.barGroup
                .selectAll(".bar")
                .data(this.viewModel.dataPoints);

            bars.enter()
                .append("rect")
                .classed("bar", true);

            bars
                .attr({
                    width: xScale.rangeBand(),
                    height: d => height - yScale(d.value) - xAxisPadding,
                    y: d => yScale(d.value),
                    x: d => xScale(d.category)
                })
                .style({
                    fill: d => d.colour,
                    "fill-opacity": d => this.viewModel.highlights ? d.highlighted ? 1.0 : 0.5 : 1.0
                })
                .on("click", d => {
                    this.selectionManager
                        .select(d.identity, true)
                        .then(ids => {
                            bars.style({
                                "fill-opacity": ids.length > 0 ?
                                    d => ids.indexOf(d.identity) >= 0 ? 1.0 : 0.5
                                    : 1.0
                            });
                        });
                })
                .on("mouseover", d => {
                    let mouse = d3.mouse(this.svg.node());
                    let x = mouse[0];
                    let y = mouse[1];
                    
                    this.host.tooltipService.show({
                        dataItems: d.tooltips,
                        identities: [d.identity],
                        coordinates: [x, y],
                        isTouchEvent: false
                    });
                })
                .on("mousemove", d => {
                    let mouse = d3.mouse(this.svg.node());
                    let x = mouse[0];
                    let y = mouse[1];
                    
                    this.host.tooltipService.move({
                        dataItems: d.tooltips,
                        identities: [d.identity],
                        coordinates: [x, y],
                        isTouchEvent: false
                    });
                })
                .on("mouseout", d => {
                    this.host.tooltipService.hide({
                        immediately: true,
                        isTouchEvent: false
                    });
                });

            bars.exit()
                .remove();
        }

        private updateSettings(options: VisualUpdateOptions) {
            this.settings.axis.x.show.value = DataViewObjects.getValue(
                options.dataViews[0].metadata.objects, {
                    objectName: "xAxis",
                    propertyName: "show"
                },
                this.settings.axis.x.show.default);

            this.settings.axis.y.show.value = DataViewObjects.getValue(
                options.dataViews[0].metadata.objects, {
                    objectName: "yAxis",
                    propertyName: "show"
                },
                this.settings.axis.y.show.default);
        }

        private getViewModel(options: VisualUpdateOptions): ViewModel {

            let dv = options.dataViews;

            let viewModel: ViewModel = {
                dataPoints: [],
                maxValue: 0,
                highlights: false,
                average: 0
            };

            if (!dv
                || !dv[0]
                || !dv[0].categorical
                || !dv[0].categorical.categories
                || !dv[0].categorical.categories[0].source
                || !dv[0].categorical.values
                || !dv[0].metadata)
                return viewModel;

            let view = dv[0].categorical;
            let categories = view.categories[0];
            let values = view.values[0];
            let highlights = values.highlights;
            let objects = categories.objects;
            let metadata = dv[0].metadata;
            let categoryColumnName = metadata.columns.filter(c => c.roles["category"])[0].displayName;
            let valueColumnName = metadata.columns.filter(c => c.roles["measure"])[0].displayName;

            for (let i = 0, len = Math.max(categories.values.length, values.values.length); i < len; i++) {
                viewModel.dataPoints.push({
                    category: <string>categories.values[i],
                    value: <number>values.values[i],
                    colour: objects && objects[i] && DataViewObjects.getFillColor(objects[i], {
                        objectName: "dataColors",
                        propertyName: "fill"
                    }, null) || this.host.colorPalette.getColor(<string>categories.values[i]).value,
                    identity: this.host.createSelectionIdBuilder()
                        .withCategory(categories, i)
                        .createSelectionId(),
                    highlighted: highlights ? highlights[i] ? true : false : false,
                    tooltips: [
                        {
                            displayName: categoryColumnName,
                            value: <string>categories.values[i]
                        },
                        {
                            displayName: valueColumnName,
                            value: (<number>values.values[i]).toFixed(2)
                        }
                    ]
                });
            }

            viewModel.maxValue = d3.max(viewModel.dataPoints, d => d.value);
            viewModel.highlights = viewModel.dataPoints.filter(d => d.highlighted).length > 0;

            if (viewModel.dataPoints.length > 0) {
                viewModel.average = d3.sum(viewModel.dataPoints, d => d.value) / viewModel.dataPoints.length;
            }

            for (let dp of viewModel.dataPoints) {
                dp.tooltips.push({
                    displayName: "Deviation (abs)",
                    value: (dp.value - viewModel.average).toFixed(2)
                });
            }

            if(viewModel.average !== 0) {
                for (let dp of viewModel.dataPoints) {
                    dp.tooltips.push({
                        displayName: "Deviation (%)",
                        value: (100 * (dp.value - viewModel.average) / viewModel.average).toFixed(2) + "%"
                    })
                }
            }

            return viewModel;
        }

    }
}
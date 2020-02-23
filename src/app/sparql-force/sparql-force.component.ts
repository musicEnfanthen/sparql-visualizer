import {
    Component,
    OnInit,
    OnChanges,
    SimpleChanges,
    ViewChild,
    ElementRef,
    Input,
    Output,
    EventEmitter,
    HostListener
} from '@angular/core';

import * as _ from 'lodash';
import * as d3_save_svg from 'd3-save-svg';
import * as N3 from 'n3';
import * as screenfull from 'screenfull';

import { PrefixSimplePipe } from '../pipes/prefix-simple.pipe';

// Tell TS D3 exists as a variable/object somewhere globally
declare const d3: any;

export interface INode {
    id: string;
    label: string;
    weight: number;
    type: string;
    owlClass: boolean;
    instance: boolean;
    // instSpace?: boolean; //MB
    // instSpaceType?: boolean; //MB
}

export interface ILink {
    source: INode;
    target: INode;
    predicate: string;
    weight: number;
}

export interface ITriples {
    nodeSubject: Node;
    nodePredicate: Node;
    nodeObject: Node;
}

export interface IGraph {
    nodes: INode[];
    links: ILink[];
    nodeTriples: ITriples[];
}

export class Node implements INode {
    id: string;
    label: string;
    weight: number;
    type: string;
    owlClass: boolean;
    instance: boolean;

    // set default values
    constructor(id: string, weight: number, type: string) {
        this.id = id;
        this.label = id;
        this.weight = weight;
        this.type = type;
        this.owlClass = false;
        this.instance = false;
    }
}

export class Link implements ILink {
    source: Node;
    target: Node;
    predicate: string;
    weight: number;
}

export class Triples implements ITriples {
    nodeSubject: Node;
    nodePredicate: Node;
    nodeObject: Node;
}

export class Graph implements IGraph {
    nodes: Node[];
    links: Link[];
    nodeTriples: Triples[];
}




@Component({
    selector: 'app-sparql-force',
    templateUrl: './sparql-force.component.html',
    styleUrls: ['./sparql-force.component.css']
})
export class SparqlForceComponent implements OnInit, OnChanges {
    @Input() public data: Array<any>;
    @Input() public height: number;
    @Output() clickedURI = new EventEmitter<string>();
    @ViewChild('chart', { static: true }) private chartContainer: ElementRef;

    private graph: Graph;
    private svg;
    private force;
    public fullScreen = false; // Fullscreen on?

    private divWidth: number;
    private divHeight: number;
    private widthBeforeResize: number;

    private limit = '100';

    // Time
    private timeEnter: number;
    private timeOut: number;

    constructor(private prefixSimplePipe: PrefixSimplePipe) {}

    ngOnInit() {
        if (this.data) {
            // set initial height
            if (this.height) {
                this.divHeight = this.height;
            } else {
                this.divHeight = this.getContainerHeight() ? this.getContainerHeight() : 500;
            }
            this.redraw();
        }

        this.getContainerHeight();
    }

    /* TODO: refactor, cf. https://github.com/sindresorhus/screenfull.js/
    fullscreen() {
        this.fullScreen = !this.fullScreen;
        const el = this.chartContainer.nativeElement;

        // Record initial screen width when changing to fullscreen
        if (this.fullScreen) { this.widthBeforeResize = el.clientWidth; }

        if (screenfull.isEnabled) {
            screenfull.toggle(el);
        }
    }*/

    ngOnChanges(changes: SimpleChanges) {
        if (changes.data.currentValue && !changes.data.isFirstChange()) {
            this.data = changes.data.currentValue;
            this.redraw();
        }
    }

    getContainerHeight(): number {
        if (!this.chartContainer || !this.chartContainer.nativeElement) {
            return null;
        }
        return this.chartContainer.nativeElement.clientHeight;
    }

    redraw() {
        this.cleanGraph();
        this.createChart();
        this.attachData();
    }

    // Redraw on resize
    @HostListener('window:resize') onResize() {
        if (!this.chartContainer) {
            return;
        }
        const el = this.chartContainer.nativeElement;

        // guard against resize before view is rendered
        if (this.chartContainer) {
            // When changing from fullscreen the recorded width before resize is used
            if (!this.fullScreen && this.widthBeforeResize) {
                this.divWidth = this.widthBeforeResize;
                this.widthBeforeResize = null;
            } else {
                this.divWidth = el.clientWidth;
            }

            this.divHeight = this.fullScreen ? el.clientHeight : this.height;

            // Redraw
            d3.selectAll('svg').remove();
            this.redraw();
        }
    }

    // Resize on scroll
    @HostListener('mousewheel', ['$event']) onScroll(ev) {
        const delta = Math.max(-1, Math.min(1, ev.wheelDelta || -ev.detail));
        if (delta > 0) {
            console.log('zoom in');
        } else if (delta < 0) {
            console.log('zoom out');
        }
    }

    saveSVG() {
        const config = {
            filename: 'sparql-viz-graph'
        };
        d3_save_svg.save(d3.select('svg').node(), config);
    }

    createChart() {
        const element = this.chartContainer.nativeElement;

        // Get container width
        if (!this.divWidth) {
            this.divWidth = element.clientWidth;
        }
        if (!this.divHeight) {
            this.divHeight = element.clientHeight;
        }

        this.svg = d3
            .select(element)
            .append('svg')
            .attr('width', this.divWidth)
            .attr('height', this.divHeight);
    }

    attachData() {
        this.force = d3.layout
            .force()
            .charge(-500)
            .linkDistance(50)
            .size([this.divWidth, this.divHeight]);

        // Limit result length
        const limit = parseInt(this.limit, 10);
        let triples;

        if (this.data.length > limit) {
            triples = this.data.slice(0, limit);
        } else {
            triples = this.data;
        }

        // If type of data is text/turtle (not array)
        // the triples must be parsed to objects instead
        if (typeof triples === 'string') {
            this._parseTriples(triples).then(d => {
                console.log(d);
                const abr = this._abbreviateTriples(d);
                this.graph = this._triplesToGraph(abr);
                this.updateChart();
            });
        } else {
            this.graph = this._triplesToGraph(triples);

            console.log('d3GraphData', this.graph);

            this.updateChart();
        }
    }

    public clicked(d) {
        if (d3.event.defaultPrevented) {
            return;
        } // dragged

        this.clickedURI.emit(d);
    }

    cleanGraph() {
        // Remove everything below the SVG element
        d3.selectAll('svg > *').remove();
    }

    updateChart() {
        if (!this.svg) {
            return;
        }

        // ==================== Add Marker ====================
        this.svg
            .append('svg:defs')
            .selectAll('marker')
            .data(['end'])
            .enter()
            .append('svg:marker')
            .attr('id', String)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 30)
            .attr('refY', -0.5)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('svg:polyline')
            .attr('points', '0,-5 10,0 0,5');

        // ==================== Add Links ====================
        const links = this.svg
            .selectAll('.link')
            .data(this.graph.nodeTriples)
            .enter()
            .append('path')
            .attr('marker-end', 'url(#end)')
            .attr('class', 'link');

        // ==================== Add Link Names =====================
        const linkTexts = this.svg
            .selectAll('.link-text')
            .data(this.graph.nodeTriples)
            .enter()
            .append('text')
            .attr('class', 'link-text')
            .text(d => d.nodePredicate.label);

        // ==================== Add Node Names =====================
        const nodeTexts = this.svg
            .selectAll('.node-text')
            .data(this._filterNodesByType(this.graph.nodes, 'node'))
            .enter()
            .append('text')
            .attr('class', 'node-text')
            .text(d => d.label);

        // ==================== Add Node =====================
        const nodes = this.svg
            .selectAll('.node')
            .data(this._filterNodesByType(this.graph.nodes, 'node'))
            .enter()
            .append('circle')
            // .attr("class", "node")
            .attr('class', d => {
                if (d.owlClass) {
                    return 'class';
                    // }else if(d.instSpace){ //MB
                    // return "instance-space" //MB
                    // }else if(d.instSpaceType){ //MB
                    // return "instance-spaceType"	//MB
                } else if (d.label.indexOf('_:') !== -1) {
                    return 'blank';
                } else if (d.instance || d.label.indexOf('inst:') !== -1) {
                    return 'instance';
                } else {
                    return 'node';
                }
            })
            .attr('id', d => d.label)
            .attr('r', d => {
                // MB if(d.instance || d.instSpace || d.instSpaceType){
                if (d.label.indexOf('_:') !== -1) {
                    return 7;
                } else if (d.instance || d.label.indexOf('inst:') !== -1) {
                    return 10;
                } else if (d.owlClass || d.label.indexOf('inst:') !== -1) {
                    return 9;
                } else {
                    return 8;
                }
            })
            .on('click', d => {
                this.clicked(d);
            })
            .call(this.force.drag); // nodes

        // ==================== When dragging ====================
        this.force.on('tick', () => {
            nodes.attr('cx', d => d.x).attr('cy', d => d.y);

            links.attr(
                'd',
                d =>
                    'M' +
                    d.nodeSubject.x +
                    ',' +
                    d.nodeSubject.y +
                    'S' +
                    d.nodePredicate.x +
                    ',' +
                    d.nodePredicate.y +
                    ' ' +
                    d.nodeObject.x +
                    ',' +
                    d.nodeObject.y
            );

            nodeTexts.attr('x', d => d.x + 12).attr('y', d => d.y + 3);

            linkTexts
                .attr('x', d => 4 + (d.nodeSubject.x + d.nodePredicate.x + d.nodeObject.x) / 3)
                .attr('y', d => 4 + (d.nodeSubject.y + d.nodePredicate.y + d.nodeObject.y) / 3);
        });

        // ==================== Run ====================
        this.force
            .nodes(this.graph.nodes)
            .links(this.graph.links)
            .start();
    }

    private _filterNodesById(nodes, id) {
        return nodes.filter(n => n.id === id);
    }

    private _filterNodesByType(nodes, value) {
        return nodes.filter(n => n.type === value);
    }

    private _triplesToGraph(triples) {
        if (!triples) {
            return;
        }

        // Graph
        const graph: Graph = { nodes: [], links: [], nodeTriples: [] };

        // Initial Graph from triples
        triples.forEach(triple => {
            const subjId = this.prefixSimplePipe.transform(triple.subject);
            const predId = this.prefixSimplePipe.transform(triple.predicate);
            let objId = this.prefixSimplePipe.transform(triple.object);

            // round decimal numbers to 2 decimals
            if (!isNaN(objId)) {
                objId = Number(objId) % 1 === 0 ? String(Number(objId)) : String(Number(objId).toFixed(2));
            }

            let subjNode: Node = this._filterNodesById(graph.nodes, subjId)[0];
            let objNode: Node = this._filterNodesById(graph.nodes, objId)[0];

            const predNode: Node = new Node(predId, 1, 'pred');
            graph.nodes.push(predNode);

            if (subjNode == null) {
                subjNode = new Node(subjId, 1, 'node');
                // MB: here I made some mistake. The objNode.label cannot be found as it is only introduced in the next if
                // if(objNode.label == "bot:Space"){subjNode.instSpace = true} //MB
                // else if(objNode.label == "prop:SpaceType"){subjNode.instSpaceType = true} //MB
                // else{} //MB
                graph.nodes.push(subjNode);
            }

            if (objNode == null) {
                objNode = new Node(objId, 1, 'node');

                graph.nodes.push(objNode);
            }

            // If the predicate is rdf:type, the node is an OWL Class
            // Then the domain is an instance
            if (subjNode.instance === false) {
                subjNode.instance = this._checkForRdfType(predNode);
            }
            if (objNode.owlClass === false) {
                objNode.owlClass = this._checkForRdfType(predNode);
            }

            const blankLabel = '';

            graph.links.push({ source: subjNode, target: predNode, predicate: blankLabel, weight: 1 });
            graph.links.push({ source: predNode, target: objNode, predicate: blankLabel, weight: 1 });

            graph.nodeTriples.push({ nodeSubject: subjNode, nodePredicate: predNode, nodeObject: objNode });
        });

        return graph;
    }

    private _parseTriples(triples) {
        // ParseTriples
        const parser = N3.Parser();
        const jsonTriples = [];
        return new Promise((resolve, reject) => {
            parser.parse(triples, (err, triple, prefixValues) => {
                if (triple) {
                    jsonTriples.push(triple);
                } else {
                    resolve({ triples: jsonTriples, prefixes: prefixValues });
                }
                if (err) {
                    reject(err);
                }
            });
        });
    }

    private _abbreviateTriples(data) {
        const prefixes = data.prefixes;
        const triples = [];

        function abbreviate(foi) {
            let newVal = null;
            // If FoI has 'http' in its name, continue
            if (foi.indexOf('http') !== -1) {
                // Loop over prefixes
                _.each(prefixes, (val, key) => {
                    // If the FoI has the prefixed namespace in its name, return it
                    if (foi.indexOf(val) !== -1) {
                        newVal = foi.replace(val, key + ':');
                    }
                });
            }
            return newVal;
        }

        _.each(data.triples, d => {
            let s = d.subject;
            let p = d.predicate;
            let o = d.object;

            if (abbreviate(s) != null) {
                s = abbreviate(s);
            }
            if (abbreviate(p) != null) {
                p = abbreviate(p);
            }
            if (abbreviate(o) != null) {
                o = abbreviate(o);
            }
            triples.push({ subject: s, predicate: p, object: o });
        });
        console.log(triples);
        return triples;
    }


    private _checkForRdfType(predNode: Node): boolean {
        return (
            // rdf:type
            predNode.label === 'a' ||
            predNode.label === 'rdf:type' ||
            predNode.label === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
        );
    }
}

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
import * as d3 from 'd3';
import * as d3_save_svg from 'd3-save-svg';
import * as N3 from 'n3';
import * as screenfull from 'screenfull';

import { PrefixSimplePipe } from '../pipes/prefix-simple.pipe';

export class Node implements d3.SimulationNodeDatum {
    id: string;
    label: string;
    weight: number;
    type: string;
    owlClass: boolean;
    instance: boolean;
    // instSpace?: boolean; //MB
    // instSpaceType?: boolean; //MB

    // optional properties from d3.SimulationNodeDatum
    index?: number;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;

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

export class Link implements d3.SimulationLinkDatum<Node> {
    source: Node | string | number;
    target: Node | string | number;

    predicate: string;
    weight: number;

    // optional properties from d3.SimulationLinkDatum
    index?: number;

    // set default values
    //  source: predNode, target: objNode, predicate: blankLabel, weight: 1
    constructor(source: Node | string | number, target: Node | string | number, predicate: string, weight: number) {
        this.source = source;
        this.target = target;
        this.predicate = predicate;
        this.weight = weight;
    }
}

export class Triples {
    nodeSubject: Node;
    nodePredicate: Node;
    nodeObject: Node;

    constructor(nodeSubject: Node, nodePredicate: Node, nodeObject: Node) {
        this.nodeSubject = nodeSubject;
        this.nodePredicate = nodePredicate;
        this.nodeObject = nodeObject;
    }
}

export class Graph {
    nodes: Node[];
    links: Link[];
    nodeTriples: Triples[];

    constructor() {
        this.nodes = [];
        this.links = [];
        this.nodeTriples = [];
    }
}

export interface D3Simulation extends d3.Simulation<Node, Link> {}

export interface D3Selection extends d3.Selection<any, any, any, any> {}


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
    private svg: D3Selection;
    private forceSimulation: D3Simulation;

    private divWidth: number;
    private divHeight: number;
    private widthBeforeResize: number;

    public fullScreen = false; // Fullscreen on?
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

    setupForceSimulation() {
        // set up the simulation
        this.forceSimulation = d3.forceSimulation();

        // Create forces
        const chargeForce = d3.forceManyBody().strength(-50);

        const centerForce = d3.forceCenter(this.divWidth / 2, this.divHeight / 2);

        // create a custom link force with id accessor to use named sources and targets
        const linkForce = d3.forceLink()
            .links(this.graph.links)
            .id((d: Link) => d.predicate)
            .distance(50);

        // add forces
        // we're going to add a charge to each node
        // also going to add a centering force
        // also going to add the custom link force
        this.forceSimulation
            .force("charge_force", chargeForce)
            .force("center_force", centerForce);

        // add nodes to the simulation
        this.forceSimulation.nodes(this.graph.nodes);

        // add links  to the simulation
        this.forceSimulation.force("links", linkForce);

    }

    attachData() {

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

                this.setupForceSimulation();
                this.updateChart();
            });
        } else {
            this.graph = this._triplesToGraph(triples);

            console.log('d3GraphData', this.graph);

            this.setupForceSimulation();
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
        const links: D3Selection = this.svg
            .selectAll('.link')
            .data(this.graph.nodeTriples)
            .enter()
            .append('path')
            .attr('marker-end', 'url(#end)')
            .attr('class', 'link');

        // ==================== Add Link Names =====================
        const linkTexts: D3Selection = this.svg
            .selectAll('.link-text')
            .data(this.graph.nodeTriples)
            .enter()
            .append('text')
            .attr('class', 'link-text')
            .text((d: Triples) => d.nodePredicate.label);

        // ==================== Add Node Names =====================
        const nodeTexts:D3Selection = this.svg
            .selectAll('.node-text')
            .data(this._filterNodesByType(this.graph.nodes, 'node'))
            .enter()
            .append('text')
            .attr('class', 'node-text')
            .text((d: Node) => d.label);

        // ==================== Add Node =====================
        const nodes: D3Selection = this.svg
            .selectAll('.node')
            .data(this._filterNodesByType(this.graph.nodes, 'node'))
            .enter()
            .append('circle')
            // .attr("class", "node")
            .attr('class', (d: Node) => {
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
            .attr('id', (d: Node) => d.label)
            .attr('r', (d: Node) => {
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
            .on('click', (d: Node) => {
                this.clicked(d);
            });

        // ==================== When dragging ====================
        this.forceSimulation.on('tick', () => {
            nodes.attr('cx', (d: Node) => d.x).attr('cy', (d: Node) => d.y);

            links.attr(
                'd',
                (d: Triples) =>
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

            nodeTexts.attr('x', (d: Node) => d.x + 12).attr('y', (d: Node) => d.y + 3);

            linkTexts
                .attr('x', (d: Triples) => 4 + (d.nodeSubject.x + d.nodePredicate.x + d.nodeObject.x) / 3)
                .attr('y', (d: Triples) => 4 + (d.nodeSubject.y + d.nodePredicate.y + d.nodeObject.y) / 3);
        });
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
        const graph: Graph = new Graph();

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

            graph.links.push(new Link(subjNode, predNode, blankLabel, 1 ));
            graph.links.push(new Link(predNode, objNode, blankLabel, 1 ));

            graph.nodeTriples.push(new Triples(subjNode, predNode, objNode ));
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

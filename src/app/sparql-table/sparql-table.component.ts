import { Component, Input, OnInit, OnChanges, SimpleChanges, EventEmitter, Output, ViewChild, AfterViewInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';

import * as _ from 'lodash';
import { ExportToCsv } from 'ts-export-to-csv';

import { SelectDialogComponent } from '../dialogs/select-dialog.component';
import { DataService } from '../services/data.service';

/**
 * @title Table with filtering
 */
@Component({
    selector: 'app-sparql-table',
    styleUrls: ['sparql-table.component.css'],
    templateUrl: 'sparql-table.component.html'
})

export class SparqlTableComponent implements OnChanges, OnInit, AfterViewInit {

    @Input() queryResult: object;
    @Input() maxHeight;
    @Input() queryTime: object;
    @Output() clickedURI = new EventEmitter<string>();

    // Paginator
    @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;


    displayedColumns;
    dataSource;
    resultLength: number;
    prefixes: object;
    showDatatypes = false;

    constructor(
        private ds: DataService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog
    ) {}

    ngOnInit() {
        this.ds.getPrefixes().subscribe(res => {
            this.prefixes = res;
        });
    }

    /**
     * Set the paginator after the view init since this component will
     * be able to query its view for the initialized paginator.
     */
    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
    }

    ngOnChanges(changes: SimpleChanges) {
        let data: Element[];

        // If a result has been returned
        if (changes.queryResult.currentValue && changes.queryResult.currentValue.head && changes.queryResult.currentValue.head.vars.length > 0) {

            // Extract columns
            this.displayedColumns = changes.queryResult.currentValue.head.vars;

            // Extract results
            const bindings = changes.queryResult.currentValue.results.bindings;

            data = bindings;

            this.resultLength = data.length;

            // If no result has been returned
        } else {
            this.displayedColumns = [];
            data = [];
            this.resultLength = data.length;
        }

        // Load data source
        this.dataSource = new MatTableDataSource<Element>(data);

        // Paginator
        this.dataSource.paginator = this.paginator;
    }

    clickElement(el) {
        if (el.type === 'uri') {
            this.clickedURI.emit(el.value);
        }
    }

    showExportCsv() {

        const dialogRef = this.dialog.open(SelectDialogComponent, {
            height: '300px',
            width: '500px',
            data: {
                title: 'Export to CSV',
                description: 'Please choose seperator',
                selectText: 'seperator',
                list: [',', ';']}
        });

        dialogRef.afterClosed().subscribe(separator => {
            this.exportCsv(separator);
        });

    }

    exportCsv(separator) {

        // If ; used as separator, comma is used as decimal separator
        const decimalSeparator = separator === ';' ? ',' : '.';

        const options = {
            fieldSeparator: separator,
            quoteStrings: '"',
            decimalseparator: decimalSeparator,
            showLabels: true,
            showTitle: false,
            filename: 'SPARQL-viz export',
            useBom: true
        };

        const data = _.map(this.dataSource.data, x => {
            return _.mapValues(x, y => y.value);
        });

        const csvExporter = new ExportToCsv(options);

        csvExporter.generateCsv(data);
    }

    showSnackbar(message, durationValue?) {
        if (!durationValue) { durationValue = 2000; }
        this.snackBar.open(message, 'close', {
            duration: durationValue,
        });
    }

}

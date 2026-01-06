/**
 * qlik-voronoi-properties.js
 * Simplified property panel for Voronoi Treemap
 */
define([], function() {
    'use strict';

    return {
        type: 'items',
        component: 'accordion',
        items: {
            // Data
            dimensions: {
                uses: 'dimensions',
                min: 1,
                max: 2,
                items: {
                    info: {
                        component: 'text',
                        label: 'Setup',
                        style: 'hint',
                        content: 'Dim 1: Item | Dim 2 (optional): Group for colors'
                    }
                }
            },
            measures: {
                uses: 'measures',
                min: 1,
                max: 1
            },
            sorting: {
                uses: 'sorting'
            },

            // Main Settings
            voronoiSettings: {
                type: 'items',
                label: 'Voronoi Settings',
                items: {
                    clipShape: {
                        type: 'string',
                        component: 'dropdown',
                        label: 'Shape',
                        ref: 'settings.clipShape',
                        options: [
                            { value: 'circle', label: 'Circle' },
                            { value: 'rectangle', label: 'Rectangle' },
                            { value: 'hexagon', label: 'Hexagon' }
                        ],
                        defaultValue: 'circle'
                    },
                    maxCells: {
                        type: 'integer',
                        label: 'Max Items',
                        ref: 'settings.maxCells',
                        defaultValue: 50,
                        min: 5,
                        max: 200
                    }
                }
            },

            // Colors
            colors: {
                type: 'items',
                label: 'Colors',
                items: {
                    colorMode: {
                        type: 'string',
                        component: 'dropdown',
                        label: 'Color By',
                        ref: 'settings.colorMode',
                        options: [
                            { value: 'auto', label: 'Automatic Palette' },
                            { value: 'master', label: 'Master Item Colors' },
                            { value: 'single', label: 'Single Color' }
                        ],
                        defaultValue: 'auto'
                    },
                    colorPalette: {
                        type: 'string',
                        component: 'dropdown',
                        label: 'Palette',
                        ref: 'settings.colorPalette',
                        options: [
                            { value: 'vibrant', label: 'Vibrant' },
                            { value: 'Q10', label: 'Qlik' },
                            { value: 'category10', label: 'D3 Classic' },
                            { value: 'earth', label: 'Earth' },
                            { value: 'ocean', label: 'Ocean' }
                        ],
                        defaultValue: 'vibrant',
                        show: function(d) { return !d.settings || d.settings.colorMode === 'auto'; }
                    },
                    singleColor: {
                        label: 'Color',
                        component: 'color-picker',
                        ref: 'settings.singleColor',
                        type: 'object',
                        defaultValue: { index: -1, color: '#4A90D9' },
                        show: function(d) { return d.settings && d.settings.colorMode === 'single'; }
                    },
                    backgroundColor: {
                        label: 'Background',
                        component: 'color-picker',
                        ref: 'settings.backgroundColor',
                        type: 'object',
                        defaultValue: { index: -1, color: '#1a1a2e' }
                    }
                }
            },

            // Cell Style
            cellStyle: {
                type: 'items',
                label: 'Cell Style',
                items: {
                    cellOpacity: {
                        type: 'number',
                        component: 'slider',
                        label: 'Fill Opacity',
                        ref: 'settings.cellOpacity',
                        min: 0.3,
                        max: 1,
                        step: 0.1,
                        defaultValue: 0.85
                    },
                    strokeWidth: {
                        type: 'number',
                        component: 'slider',
                        label: 'Border Width',
                        ref: 'settings.strokeWidth',
                        min: 0,
                        max: 10,
                        step: 0.5,
                        defaultValue: 2
                    },
                    strokeColor: {
                        label: 'Border Color',
                        component: 'color-picker',
                        ref: 'settings.strokeColor',
                        type: 'object',
                        defaultValue: { index: -1, color: '#FFFFFF' }
                    }
                }
            },

            // Labels
            labels: {
                type: 'items',
                label: 'Labels',
                items: {
                    showLabels: {
                        type: 'boolean',
                        label: 'Show Labels',
                        ref: 'settings.showLabels',
                        defaultValue: true
                    },
                    showValues: {
                        type: 'boolean',
                        label: 'Show Values',
                        ref: 'settings.showValues',
                        defaultValue: true
                    },
                    labelSize: {
                        type: 'integer',
                        label: 'Max Font Size',
                        ref: 'settings.labelSize',
                        defaultValue: 14,
                        min: 8,
                        max: 24,
                        show: function(d) { return !d.settings || d.settings.showLabels !== false; }
                    },
                    fontColorMode: {
                        type: 'string',
                        component: 'dropdown',
                        label: 'Font Color',
                        ref: 'settings.fontColorMode',
                        options: [
                            { value: 'auto', label: 'Auto (Contrast)' },
                            { value: 'custom', label: 'Custom' }
                        ],
                        defaultValue: 'auto',
                        show: function(d) { return !d.settings || d.settings.showLabels !== false; }
                    },
                    fontColor: {
                        label: 'Custom Font Color',
                        component: 'color-picker',
                        ref: 'settings.fontColor',
                        type: 'object',
                        defaultValue: { index: -1, color: '#FFFFFF' },
                        show: function(d) { return d.settings && d.settings.showLabels !== false && d.settings.fontColorMode === 'custom'; }
                    }
                }
            },

            // Tooltip
            tooltip: {
                type: 'items',
                label: 'Tooltip',
                items: {
                    showTooltip: {
                        type: 'boolean',
                        label: 'Show Tooltip',
                        ref: 'settings.showTooltip',
                        defaultValue: true
                    }
                }
            },

            // Debug
            debug: {
                type: 'items',
                label: 'Debug',
                items: {
                    enableDebug: {
                        type: 'boolean',
                        component: 'switch',
                        label: 'Enable Console Logging',
                        ref: 'settings.enableDebug',
                        defaultValue: false,
                        options: [
                            { value: true, label: 'On' },
                            { value: false, label: 'Off' }
                        ]
                    }
                }
            },

            appearance: {
                uses: 'settings'
            },

            addons: {
                uses: 'addons',
                items: {
                    dataHandling: {
                        uses: 'dataHandling'
                    }
                }
            }
        }
    };
});

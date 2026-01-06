/**
 * qlik-voronoi-constants.js
 * Centralized constants for the Voronoi Treemap extension
 */
define([], function() {
    'use strict';

    return {
        // Animation and timing
        TIMING: {
            RESIZE_DEBOUNCE: 300,
            ANIMATION_FAST: 200,
            ANIMATION_MEDIUM: 500,
            ANIMATION_SLOW: 750,
            VORONOI_CONVERGE: 50
        },

        // Voronoi computation settings
        VORONOI: {
            CONVERGENCE_RATIO: 0.01,
            MAX_ITERATIONS: 50,
            MIN_WEIGHT_RATIO: 0.01,
            DEFAULT_CLIP_PADDING: 2
        },

        // Font scaling factors
        FONT_SCALE: {
            LABEL: 0.15,
            VALUE: 0.12,
            GROUP: 0.08,
            MIN_FONT_SIZE: 8,
            MAX_FONT_SIZE: 24
        },

        // Tooltip settings
        TOOLTIP: {
            Z_INDEX: 10000,
            PADDING: '12px 16px',
            BORDER_RADIUS: '6px',
            FONT_SIZE: '13px',
            MAX_WIDTH: '300px'
        },

        // Default appearance values
        DEFAULTS: {
            MAX_CELLS: 100,
            CELL_PADDING: 2,
            CELL_OPACITY: 0.85,
            STROKE_WIDTH: 1.5,
            STROKE_OPACITY: 0.8,
            HOVER_OPACITY: 1,
            HOVER_SCALE: 1.02,
            LABEL_SIZE: 12,
            VALUE_SIZE: 10,
            GROUP_LABEL_SIZE: 14,
            MIN_AREA_FOR_LABEL: 1500,
            MIN_AREA_FOR_VALUE: 2500,
            SHOW_HIERARCHY_LEVELS: true
        },

        // Default colors
        COLORS: {
            BACKGROUND: '#FFFFFF',
            STROKE: '#FFFFFF',
            LABEL: '#FFFFFF',
            VALUE: 'rgba(255,255,255,0.85)',
            GROUP_LABEL: '#333333',
            SINGLE: '#4A90D9',
            FALLBACK: [
                '#4A90D9', '#E85D75', '#50C878', '#FFB347',
                '#9B59B6', '#3498DB', '#E74C3C', '#2ECC71',
                '#F39C12', '#1ABC9C'
            ]
        },

        // Color palettes
        PALETTES: {
            vibrant: [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
                '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
                '#BB8FCE', '#85C1E9'
            ],
            earth: [
                '#8B4513', '#D2691E', '#CD853F', '#DEB887',
                '#F5DEB3', '#D2B48C', '#BC8F8F', '#F4A460',
                '#DAA520', '#B8860B'
            ],
            ocean: [
                '#001f3f', '#0074D9', '#7FDBFF', '#39CCCC',
                '#3D9970', '#2ECC40', '#01FF70', '#FFDC00',
                '#FF851B', '#FF4136'
            ],
            sunset: [
                '#FF6B35', '#F7C59F', '#EFEFD0', '#004E89',
                '#1A659E', '#FF9F1C', '#E71D36', '#2EC4B6',
                '#FFBF69', '#CBF3F0'
            ],
            nordic: [
                '#2E4057', '#048A81', '#54C6EB', '#8EE3EF',
                '#F7F7F7', '#084C61', '#DB504A', '#E3B505',
                '#4F6D7A', '#56A3A6'
            ],
            Q10: [
                '#767DF2', '#BF2B17', '#F25C06', '#65AA88',
                '#039289', '#1A778B', '#FA8907', '#F7BB02',
                '#D5BD4B', '#17becf'
            ],
            category10: [
                '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
                '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
                '#bcbd22', '#17becf'
            ],
            category20: [
                '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78',
                '#2ca02c', '#98df8a', '#d62728', '#ff9896',
                '#9467bd', '#c5b0d5', '#8c564b', '#c49c94',
                '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7',
                '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'
            ]
        },

        // Clip shapes for the treemap boundary
        CLIP_SHAPES: {
            RECTANGLE: 'rectangle',
            CIRCLE: 'circle',
            HEXAGON: 'hexagon',
            ROUNDED_RECT: 'roundedRect'
        }
    };
});

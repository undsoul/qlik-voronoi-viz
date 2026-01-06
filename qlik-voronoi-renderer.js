/**
 * qlik-voronoi-renderer.js
 * Voronoi Treemap rendering using D3.js
 */
define([
    './qlik-voronoi-constants',
    './qlik-voronoi-colors'
], function(CONSTANTS, ColorUtils) {
    'use strict';

    /**
     * Escape HTML to prevent XSS attacks
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Generate clip polygon based on shape
     */
    function generateClipPolygon(width, height, shape, padding) {
        padding = padding || 10;
        var cx = width / 2;
        var cy = height / 2;
        var r = Math.min(width, height) / 2 - padding;

        switch (shape) {
            case 'circle':
                var points = [];
                var numPoints = 64;
                for (var i = 0; i < numPoints; i++) {
                    var angle = (i / numPoints) * 2 * Math.PI - Math.PI / 2;
                    points.push([
                        cx + r * Math.cos(angle),
                        cy + r * Math.sin(angle)
                    ]);
                }
                return points;

            case 'hexagon':
                var hexPoints = [];
                for (var j = 0; j < 6; j++) {
                    var hexAngle = (j / 6) * 2 * Math.PI - Math.PI / 2;
                    hexPoints.push([
                        cx + r * Math.cos(hexAngle),
                        cy + r * Math.sin(hexAngle)
                    ]);
                }
                return hexPoints;

            case 'rectangle':
            default:
                return [
                    [padding, padding],
                    [width - padding, padding],
                    [width - padding, height - padding],
                    [padding, height - padding]
                ];
        }
    }

    /**
     * Calculate polygon area with validation
     */
    function polygonArea(polygon) {
        if (!polygon || !Array.isArray(polygon) || polygon.length < 3) return 0;
        var n = polygon.length;
        var area = 0;
        for (var i = 0, j = n - 1; i < n; j = i++) {
            // Validate polygon points
            if (!polygon[j] || !polygon[i] ||
                typeof polygon[j][0] !== 'number' || typeof polygon[j][1] !== 'number' ||
                typeof polygon[i][0] !== 'number' || typeof polygon[i][1] !== 'number') {
                return 0;
            }
            area += (polygon[j][0] + polygon[i][0]) * (polygon[j][1] - polygon[i][1]);
        }
        return Math.abs(area / 2);
    }

    /**
     * Calculate polygon centroid with validation
     */
    function polygonCentroid(polygon) {
        if (!polygon || !Array.isArray(polygon) || polygon.length < 3) return [0, 0];
        var n = polygon.length;
        var cx = 0, cy = 0;
        var validPoints = 0;
        for (var i = 0; i < n; i++) {
            // Validate point data
            if (polygon[i] && typeof polygon[i][0] === 'number' && typeof polygon[i][1] === 'number') {
                cx += polygon[i][0];
                cy += polygon[i][1];
                validPoints++;
            }
        }
        // Guard against divide by zero
        if (validPoints === 0) return [0, 0];
        return [cx / validPoints, cy / validPoints];
    }

    /**
     * Generate unique ID for this renderer instance
     */
    var rendererIdCounter = 0;

    /**
     * Voronoi Renderer
     */
    function VoronoiRenderer(d3, container, options) {
        this.d3 = d3;
        this.container = container;
        this.options = options || {};
        this.svg = null;
        this.tooltip = null;
        this._polygonCache = null;  // Cache for voronoi polygons
        this._rendererId = 'voronoi-' + (++rendererIdCounter) + '-' + Date.now();
    }

    /**
     * Initialize SVG and tooltip
     */
    VoronoiRenderer.prototype.init = function(width, height, settings) {
        var d3 = this.d3;
        var self = this;

        // Validate inputs
        if (!this.container) {
            console.warn('[VoronoiRenderer] No container provided');
            return this;
        }
        if (width <= 0 || height <= 0) {
            console.warn('[VoronoiRenderer] Invalid dimensions:', width, height);
            return this;
        }

        // Clear container
        d3.select(this.container).selectAll('*').remove();

        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background-color', ColorUtils.getColor(settings.backgroundColor, '#1a1a2e'));

        // Main group
        this.mainGroup = this.svg.append('g').attr('class', 'voronoi-main');

        // Tooltip - use unique ID to prevent memory leaks
        var tooltipId = 'tooltip-' + this._rendererId;

        // Remove any existing tooltip with this ID
        d3.select('#' + tooltipId).remove();
        if (this.tooltip) this.tooltip.remove();

        this.tooltip = d3.select('body').append('div')
            .attr('id', tooltipId)
            .attr('class', 'voronoi-tooltip')
            .style('position', 'absolute')
            .style('padding', '10px 14px')
            .style('background', 'rgba(0,0,0,0.9)')
            .style('color', '#fff')
            .style('border-radius', '6px')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 10000);

        return this;
    };

    /**
     * Render the Voronoi treemap
     */
    VoronoiRenderer.prototype.render = function(hierarchyData, settings, colorScale, callbacks) {
        var self = this;
        var d3 = this.d3;

        if (!this.svg) return;

        // Validate input parameters
        if (!hierarchyData || !hierarchyData.children || !Array.isArray(hierarchyData.children)) {
            console.warn('[VoronoiRenderer] Invalid hierarchy data');
            return;
        }

        // Ensure callbacks is an object
        callbacks = callbacks || {};

        var width = parseInt(this.svg.attr('width'), 10) || 0;
        var height = parseInt(this.svg.attr('height'), 10) || 0;

        // Guard against invalid dimensions
        if (width <= 0 || height <= 0) {
            console.warn('[VoronoiRenderer] Invalid SVG dimensions in render:', width, height);
            return;
        }

        // Generate clip polygon
        var clipShape = settings.clipShape || 'circle';
        var clipPolygon = generateClipPolygon(width, height, clipShape, 15);

        // Generate cache key from data structure (name + value pairs)
        var cacheKey = hierarchyData.children.map(function(group) {
            var childKeys = group.children ? group.children.map(function(c) {
                return c.name + ':' + c.value;
            }).join(',') : '';
            return group.name + '[' + childKeys + ']';
        }).join('|') + '|' + clipShape + '|' + width + 'x' + height;

        // Check if we have valid cached polygons
        var leaves;
        if (this._polygonCache && this._polygonCache.key === cacheKey) {
            // Reuse cached leaves with their polygons
            leaves = this._polygonCache.leaves;
            if (window.VORONOI_DEBUG) {
                console.log('[VoronoiRenderer] Using cached polygons');
            }
            this.renderVoronoiCells(leaves, settings, colorScale, callbacks);
            return;
        }

        // Create hierarchy
        var root = d3.hierarchy(hierarchyData)
            .sum(function(d) { return d.value || 0; })
            .sort(function(a, b) { return b.value - a.value; });

        // Try voronoi treemap
        if (typeof d3.voronoiTreemap === 'function') {
            try {
                var voronoiTreemap = d3.voronoiTreemap()
                    .clip(clipPolygon)
                    .convergenceRatio(0.01)
                    .maxIterationCount(settings.maxIterations || 30);

                voronoiTreemap(root);

                leaves = root.leaves();

                // Cache the computed polygons
                this._polygonCache = {
                    key: cacheKey,
                    leaves: leaves
                };

                if (window.VORONOI_DEBUG) {
                    console.log('[VoronoiRenderer] Computed and cached new polygons');
                }

                this.renderVoronoiCells(leaves, settings, colorScale, callbacks);
                return;
            } catch (e) {
                if (window.VORONOI_DEBUG) {
                    console.warn('[VoronoiRenderer] Voronoi error, using fallback:', e);
                }
            }
        }

        // Fallback to standard treemap
        this.renderFallbackTreemap(root, width, height, settings, colorScale, callbacks);
    };

    /**
     * Render Voronoi cells
     */
    VoronoiRenderer.prototype.renderVoronoiCells = function(leaves, settings, colorScale, callbacks) {
        var self = this;
        var d3 = this.d3;

        var cellOpacity = settings.cellOpacity !== undefined ? settings.cellOpacity : 0.85;
        var strokeWidth = settings.strokeWidth !== undefined ? settings.strokeWidth : 2;
        var strokeColor = ColorUtils.getColor(settings.strokeColor, '#FFFFFF');

        // Selection state from callbacks
        var localSelections = callbacks && callbacks.localSelections ? callbacks.localSelections : new Set();
        var hasQlikSelection = callbacks && callbacks.hasQlikSelection;
        var hasLocalSelections = localSelections.size > 0;

        // Clear and render cells
        this.mainGroup.selectAll('*').remove();

        var cells = this.mainGroup.selectAll('.voronoi-cell')
            .data(leaves.filter(function(d) { return d.polygon && d.polygon.length >= 3; }))
            .enter()
            .append('path')
            .attr('class', 'voronoi-cell')
            .attr('d', function(d) {
                return d3.line()(d.polygon) + 'Z';
            })
            .attr('fill', function(d) {
                var group = d.data.group || (d.parent ? d.parent.data.name : 'default');
                return d.data.color || colorScale(group);
            })
            .attr('fill-opacity', function(d) {
                // Local selections take priority for immediate feedback
                if (hasLocalSelections) {
                    return localSelections.has(d.data.name) ? 1 : 0.3;
                }
                // Qlik selection state
                if (hasQlikSelection) {
                    return d.data.isSelected ? 1 : 0.3;
                }
                return cellOpacity;
            })
            .attr('stroke', strokeColor)
            .attr('stroke-width', strokeWidth)
            .style('cursor', 'pointer');

        // Interactions
        cells
            .on('click', function(event, d) {
                if (callbacks && callbacks.onSelect && d.data.elem !== undefined) {
                    callbacks.onSelect(d.data.elem, d.data.name, true);
                }
            })
            .on('mouseover', function(event, d) {
                // Only brighten on hover if not in selection mode
                if (!hasLocalSelections && !hasQlikSelection) {
                    d3.select(this).attr('fill-opacity', 1);
                }
                if (settings.showTooltip !== false) {
                    self.showTooltip(event, d);
                }
            })
            .on('mousemove', function(event) {
                self.tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function(event, d) {
                // Restore opacity based on selection state
                if (!hasLocalSelections && !hasQlikSelection) {
                    d3.select(this).attr('fill-opacity', cellOpacity);
                }
                self.tooltip.style('opacity', 0);
            });

        // Labels with selection state
        if (settings.showLabels !== false) {
            this.renderLabels(leaves, settings, colorScale, localSelections, hasQlikSelection);
        }
    };

    /**
     * Show tooltip
     */
    VoronoiRenderer.prototype.showTooltip = function(event, d) {
        var html = '<strong>' + escapeHtml(d.data.name) + '</strong>';
        if (d.data.group && d.data.group !== 'Default') {
            html += '<br><span style="color:#aaa">' + escapeHtml(d.data.group) + '</span>';
        }
        html += '<br>Value: ' + escapeHtml(d.data.formattedValue);
        if (d.data.percentage !== undefined && d.data.percentage !== null) {
            // Escape percentage to prevent XSS
            var percentStr = escapeHtml(String(d.data.percentage.toFixed(1)));
            html += '<br>Share: ' + percentStr + '%';
        }

        this.tooltip
            .html(html)
            .style('opacity', 1)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    };

    /**
     * Render labels on cells
     */
    VoronoiRenderer.prototype.renderLabels = function(leaves, settings, colorScale, localSelections, hasQlikSelection) {
        var self = this;

        var minAreaForLabel = CONSTANTS.DEFAULTS.MIN_AREA_FOR_LABEL || 1500;
        var minAreaForValue = CONSTANTS.DEFAULTS.MIN_AREA_FOR_VALUE || 2500;
        var maxFontSize = settings.labelSize || 14;

        // Selection state
        var hasLocalSelections = localSelections && localSelections.size > 0;

        // Helper to get label opacity based on selection
        function getLabelOpacity(d) {
            if (hasLocalSelections) {
                return localSelections.has(d.data.name) ? 1 : 0.55;
            }
            if (hasQlikSelection) {
                return d.data.isSelected ? 1 : 0.55;
            }
            return 1;
        }

        // Helper to get text shadow based on selection
        function getTextShadow(d) {
            var opacity = getLabelOpacity(d);
            if (opacity < 1) {
                // Enhanced shadow for deselected labels to maintain readability
                return '0 0 4px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)';
            }
            return '0 1px 2px rgba(0,0,0,0.5)';
        }

        // Filter leaves with enough area
        var labelData = leaves.filter(function(d) {
            if (!d.polygon || d.polygon.length < 3) return false;
            return polygonArea(d.polygon) >= minAreaForLabel;
        });

        // Name labels
        this.mainGroup.selectAll('.voronoi-label')
            .data(labelData)
            .enter()
            .append('text')
            .attr('class', 'voronoi-label')
            .attr('transform', function(d) {
                var c = polygonCentroid(d.polygon);
                return 'translate(' + c[0] + ',' + c[1] + ')';
            })
            .attr('dy', settings.showValues !== false ? '-0.3em' : '0.35em')
            .style('text-anchor', 'middle')
            .style('fill', function(d) {
                if (settings.fontColorMode === 'custom' && settings.fontColor) {
                    return ColorUtils.getColor(settings.fontColor, '#FFFFFF');
                }
                var bgColor = d.data.color || colorScale(d.data.group || 'default');
                return ColorUtils.getContrastColor(bgColor);
            })
            .style('font-size', function(d) {
                var area = polygonArea(d.polygon);
                var size = Math.min(maxFontSize, Math.sqrt(area) * 0.12);
                return Math.max(8, size) + 'px';
            })
            .style('font-weight', 'bold')
            .style('font-family', 'sans-serif')
            .style('pointer-events', 'none')
            .style('text-shadow', getTextShadow)
            .style('opacity', getLabelOpacity)
            .text(function(d) {
                var name = d.data.name || '';
                if (!name) return '';

                var area = polygonArea(d.polygon);
                var maxLen = Math.floor(Math.sqrt(area) / 10);

                // Only truncate if name is longer than maxLen and we have room for at least 1 char + '..'
                if (name.length > maxLen && maxLen >= 4) {
                    var truncLen = Math.max(1, maxLen - 2);
                    return name.substring(0, truncLen) + '..';
                }
                return name;
            });

        // Value labels
        if (settings.showValues !== false) {
            var valueData = leaves.filter(function(d) {
                if (!d.polygon || d.polygon.length < 3) return false;
                return polygonArea(d.polygon) >= minAreaForValue;
            });

            this.mainGroup.selectAll('.voronoi-value')
                .data(valueData)
                .enter()
                .append('text')
                .attr('class', 'voronoi-value')
                .attr('transform', function(d) {
                    var c = polygonCentroid(d.polygon);
                    return 'translate(' + c[0] + ',' + c[1] + ')';
                })
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .style('fill', function(d) {
                    if (settings.fontColorMode === 'custom' && settings.fontColor) {
                        return ColorUtils.getColor(settings.fontColor, '#FFFFFF');
                    }
                    var bgColor = d.data.color || colorScale(d.data.group || 'default');
                    return ColorUtils.getContrastColor(bgColor);
                })
                .style('font-size', function(d) {
                    var area = polygonArea(d.polygon);
                    var size = Math.min(maxFontSize - 2, Math.sqrt(area) * 0.1);
                    return Math.max(8, size) + 'px';
                })
                .style('font-family', 'sans-serif')
                .style('pointer-events', 'none')
                .style('opacity', function(d) {
                    var baseOpacity = getLabelOpacity(d);
                    return baseOpacity * 0.9; // Value labels slightly dimmer
                })
                .style('text-shadow', getTextShadow)
                .text(function(d) { return d.data.formattedValue; });
        }
    };

    /**
     * Fallback treemap rendering
     */
    VoronoiRenderer.prototype.renderFallbackTreemap = function(root, width, height, settings, colorScale, callbacks) {
        var self = this;
        var d3 = this.d3;

        var treemap = d3.treemap()
            .size([width, height])
            .padding(2)
            .round(true);

        treemap(root);

        var leaves = root.leaves();

        // Add polygon property for label positioning
        leaves.forEach(function(d) {
            d.polygon = [
                [d.x0, d.y0], [d.x1, d.y0],
                [d.x1, d.y1], [d.x0, d.y1]
            ];
        });

        this.mainGroup.selectAll('*').remove();

        var cellOpacity = settings.cellOpacity !== undefined ? settings.cellOpacity : 0.85;
        var strokeWidth = settings.strokeWidth !== undefined ? settings.strokeWidth : 2;
        var strokeColor = ColorUtils.getColor(settings.strokeColor, '#FFFFFF');

        // Selection state from callbacks
        var localSelections = callbacks && callbacks.localSelections ? callbacks.localSelections : new Set();
        var hasQlikSelection = callbacks && callbacks.hasQlikSelection;
        var hasLocalSelections = localSelections.size > 0;

        var cells = this.mainGroup.selectAll('.voronoi-cell')
            .data(leaves)
            .enter()
            .append('rect')
            .attr('class', 'voronoi-cell')
            .attr('x', function(d) { return d.x0; })
            .attr('y', function(d) { return d.y0; })
            .attr('width', function(d) { return Math.max(0, d.x1 - d.x0); })
            .attr('height', function(d) { return Math.max(0, d.y1 - d.y0); })
            .attr('fill', function(d) {
                var group = d.data.group || (d.parent ? d.parent.data.name : 'default');
                return d.data.color || colorScale(group);
            })
            .attr('fill-opacity', function(d) {
                if (hasLocalSelections) {
                    return localSelections.has(d.data.name) ? 1 : 0.3;
                }
                if (hasQlikSelection) {
                    return d.data.isSelected ? 1 : 0.3;
                }
                return cellOpacity;
            })
            .attr('stroke', strokeColor)
            .attr('stroke-width', strokeWidth)
            .style('cursor', 'pointer');

        cells
            .on('click', function(event, d) {
                if (callbacks && callbacks.onSelect && d.data.elem !== undefined) {
                    callbacks.onSelect(d.data.elem, d.data.name, true);
                }
            })
            .on('mouseover', function(event, d) {
                if (!hasLocalSelections && !hasQlikSelection) {
                    d3.select(this).attr('fill-opacity', 1);
                }
                if (settings.showTooltip !== false) {
                    self.showTooltip(event, d);
                }
            })
            .on('mousemove', function(event) {
                self.tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                if (!hasLocalSelections && !hasQlikSelection) {
                    d3.select(this).attr('fill-opacity', cellOpacity);
                }
                self.tooltip.style('opacity', 0);
            });

        if (settings.showLabels !== false) {
            this.renderLabels(leaves, settings, colorScale, localSelections, hasQlikSelection);
        }
    };

    /**
     * Clear polygon cache (call when data changes)
     */
    VoronoiRenderer.prototype.clearCache = function() {
        this._polygonCache = null;
    };

    /**
     * Destroy renderer
     */
    VoronoiRenderer.prototype.destroy = function() {
        // Clean up tooltip by ID
        if (this._rendererId) {
            this.d3.select('#tooltip-' + this._rendererId).remove();
        }
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
        if (this.svg) {
            this.svg.remove();
            this.svg = null;
        }
        this._polygonCache = null;
    };

    return {
        VoronoiRenderer: VoronoiRenderer,
        generateClipPolygon: generateClipPolygon,
        polygonArea: polygonArea,
        polygonCentroid: polygonCentroid
    };
});

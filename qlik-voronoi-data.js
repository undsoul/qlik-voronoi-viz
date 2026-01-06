/**
 * qlik-voronoi-data.js
 * Data transformation and hierarchy building for Voronoi Treemap
 */
define([
    './qlik-voronoi-constants',
    './qlik-voronoi-colors'
], function(CONSTANTS, ColorUtils) {
    'use strict';

    /**
     * Format large numbers with K/M/B/T suffixes
     */
    function formatLargeNumber(val, decimals) {
        decimals = decimals !== undefined ? decimals : 1;
        if (val >= 1e12) return (val / 1e12).toFixed(decimals) + 'T';
        if (val >= 1e9) return (val / 1e9).toFixed(decimals) + 'B';
        if (val >= 1e6) return (val / 1e6).toFixed(decimals) + 'M';
        if (val >= 1e3) return (val / 1e3).toFixed(decimals) + 'K';
        return val.toFixed(decimals);
    }

    /**
     * Build hierarchical data structure from Qlik hypercube matrix
     * @param {Array} matrix - The qMatrix from hypercube
     * @param {Object} layout - The layout object
     * @param {Object} settings - Extension settings
     * @returns {Object} Hierarchical data structure for d3.hierarchy
     */
    function buildHierarchy(matrix, layout, settings) {
        var dimensionCount = layout.qHyperCube.qDimensionInfo.length;
        var measureCount = layout.qHyperCube.qMeasureInfo.length;
        var maxCells = settings.maxCells || CONSTANTS.DEFAULTS.MAX_CELLS;

        var hierarchyData = {
            name: 'root',
            children: []
        };

        var groupMap = {};
        var processedCount = 0;
        var totalValue = 0;

        // First pass: calculate total for percentage
        matrix.forEach(function(row) {
            if (measureCount > 0 && row[dimensionCount]) {
                var val = row[dimensionCount].qNum;
                if (val !== undefined && !isNaN(val) && val > 0) {
                    totalValue += val;
                }
            }
        });

        // Second pass: build hierarchy
        matrix.forEach(function(row) {
            if (processedCount >= maxCells) return;

            // Validate row structure
            if (!Array.isArray(row) || row.length < dimensionCount + measureCount) return;
            if (!row[0]) return;

            var value = measureCount > 0 && row[dimensionCount] ? row[dimensionCount].qNum : 0;
            if (value === undefined || isNaN(value) || value <= 0) return;

            var itemName = row[0].qText || 'Unknown';
            var groupName = dimensionCount > 1 && row[1] ? (row[1].qText || 'Other') : 'Default';
            var formattedValue = measureCount > 0 && row[dimensionCount] ? (row[dimensionCount].qText || formatLargeNumber(value)) : '';
            var elem = row[0].qElemNumber;

            // Extract color from attribute expressions
            var itemColor = null;
            if (dimensionCount > 1 && row[1]) {
                // Validate qAttrExps structure before accessing
                if (row[1].qAttrExps &&
                    row[1].qAttrExps.qValues &&
                    Array.isArray(row[1].qAttrExps.qValues)) {
                    for (var i = 0; i < row[1].qAttrExps.qValues.length; i++) {
                        var attr = row[1].qAttrExps.qValues[i];
                        if (attr && attr.qText && typeof attr.qText === 'string' && attr.qText.charAt(0) === '#') {
                            itemColor = attr.qText;
                            break;
                        } else if (attr && attr.qNum !== undefined && !isNaN(attr.qNum)) {
                            itemColor = ColorUtils.argbToHex(attr.qNum);
                            break;
                        }
                    }
                }
            }

            // Find or create group
            if (!groupMap[groupName]) {
                groupMap[groupName] = {
                    name: groupName,
                    children: [],
                    color: itemColor,
                    totalValue: 0
                };
                hierarchyData.children.push(groupMap[groupName]);
            }

            // Update group color if not set
            if (itemColor && !groupMap[groupName].color) {
                groupMap[groupName].color = itemColor;
            }

            // Get selection state
            var qState = row[0].qState || 'O';
            var isSelected = qState === 'S' || qState === 'L';
            var isExcluded = qState === 'X';

            // Calculate percentage
            var percentage = totalValue > 0 ? (value / totalValue * 100) : 0;

            // Add item to group
            groupMap[groupName].children.push({
                name: itemName,
                value: value,
                formattedValue: formattedValue,
                percentage: percentage,
                elem: elem,
                group: groupName,
                color: itemColor,
                qState: qState,
                isSelected: isSelected,
                isExcluded: isExcluded
            });

            groupMap[groupName].totalValue += value;
            processedCount++;
        });

        // Calculate group percentages and set group value for d3.hierarchy
        Object.keys(groupMap).forEach(function(key) {
            var group = groupMap[key];
            group.value = group.totalValue;  // Required for d3.hierarchy.sum() to work correctly
            group.percentage = totalValue > 0 ? (group.totalValue / totalValue * 100) : 0;
            group.formattedValue = formatLargeNumber(group.totalValue);
        });

        return {
            hierarchy: hierarchyData,
            groupMap: groupMap,
            totalValue: totalValue,
            processedCount: processedCount
        };
    }

    /**
     * Get unique dimension values for color mapping
     */
    function getDimensionValues(matrix, dimensionIndex) {
        var values = [];
        var seen = {};

        matrix.forEach(function(row) {
            if (row[dimensionIndex] && row[dimensionIndex].qText && !seen[row[dimensionIndex].qText]) {
                values.push(row[dimensionIndex].qText);
                seen[row[dimensionIndex].qText] = true;
            }
        });

        return values;
    }

    /**
     * Get list of groups from hierarchy data
     */
    function getGroups(hierarchyData) {
        return hierarchyData.children.map(function(child) {
            return child.name;
        });
    }

    /**
     * Check if there's an active selection in the data
     */
    function hasActiveSelection(matrix, dimensionCount) {
        for (var i = 0; i < matrix.length; i++) {
            var state = matrix[i][0].qState;
            if (state && state !== 'O') {
                return true;
            }
        }
        return false;
    }

    /**
     * Get selected elements from matrix
     */
    function getSelectedElements(matrix) {
        var selected = [];
        matrix.forEach(function(row) {
            if (row[0].qState === 'S' || row[0].qState === 'L') {
                selected.push(row[0].qElemNumber);
            }
        });
        return selected;
    }

    // Public API
    return {
        formatLargeNumber: formatLargeNumber,
        buildHierarchy: buildHierarchy,
        getDimensionValues: getDimensionValues,
        getGroups: getGroups,
        hasActiveSelection: hasActiveSelection,
        getSelectedElements: getSelectedElements
    };
});

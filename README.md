# Voronoi Viz

**Interactive weighted Voronoi treemap visualization for Qlik Sense**

[![Version](https://img.shields.io/badge/version-24.6.0-blue.svg)](https://github.com/undsoul/qlik-voronoi-viz)
[![Qlik Sense](https://img.shields.io/badge/Qlik%20Sense-%3E%3D3.0-green.svg)](https://www.qlik.com)
[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)

Transform hierarchical data into organic visualizations where **cell area represents data values**. Unlike rectangular treemaps, Voronoi treemaps use natural curved boundaries for intuitive data exploration.

## Features

- **Proportional Areas** - Cell sizes accurately represent measure values
- **Multiple Shapes** - Circle, rectangle, or hexagon containers
- **Master Item Colors** - Automatic color sync from Qlik master dimensions
- **Interactive Selection** - Click to filter across your app
- **Smart Labels** - Auto-sizing with contrast detection
- **Qlik Cloud Ready** - Works on Desktop and Cloud

## Installation

### Qlik Sense Desktop
1. Download `qlik-voronoi-diagram-v24.6.0.zip`
2. Extract to `Documents/Qlik/Sense/Extensions/`
3. Restart Qlik Sense Desktop

### Qlik Cloud
1. Go to **Management Console** > **Extensions**
2. Click **Add** and upload the zip file

## Quick Start

| Field | Type | Description |
|-------|------|-------------|
| Dimension 1 | Required | Item names |
| Dimension 2 | Optional | Grouping (for colors) |
| Measure | Required | Values for cell area |

## Settings

### Shape & Layout
| Option | Default | Description |
|--------|---------|-------------|
| Shape | Circle | Circle, Rectangle, or Hexagon |
| Max Items | 50 | Limit cells (5-200) |

### Colors
| Option | Default | Description |
|--------|---------|-------------|
| Color Mode | Automatic | Automatic / Master Item / Single |
| Palette | Vibrant | Color scheme for Automatic mode |
| Background | #1a1a2e | Chart background |

### Cell Style
| Option | Default | Description |
|--------|---------|-------------|
| Fill Opacity | 0.85 | Cell transparency (0.3-1.0) |
| Border Width | 2 | Border thickness (0-10px) |
| Border Color | #FFFFFF | Border color |

### Labels
| Option | Default | Description |
|--------|---------|-------------|
| Show Labels | On | Display item names |
| Show Values | On | Display measure values |
| Font Color | Auto | Auto-contrast or custom |

## Performance

| Items | Performance |
|-------|-------------|
| 50-100 | Optimal |
| 100-200 | Good |
| 200+ | Not recommended |

**Optimizations included:**
- Polygon caching (90%+ faster re-renders)
- O(1) color lookups
- Resize debouncing
- Memory leak prevention

## Architecture

```
qlik-voronoi-diagram/
├── qlik-voronoi-diagram.js    # Main extension
├── qlik-voronoi-renderer.js   # D3 rendering
├── qlik-voronoi-colors.js     # Color utilities
├── qlik-voronoi-data.js       # Data processing
├── qlik-voronoi-properties.js # Property panel
├── qlik-voronoi-constants.js  # Configuration
├── qlik-voronoi-style.css     # Styles
└── lib/                       # D3.js libraries
```

## Algorithm

Uses **weighted Voronoi diagrams** (power diagrams):
1. Place seed points for each data item
2. Iterate using Lloyd's relaxation
3. Compute weighted cells (weight = value)
4. Converge when areas match target proportions

## Browser Support

Chrome 80+ | Firefox 75+ | Safari 13+ | Edge 80+

## License

MIT License - see [LICENSE](LICENSE)

## Author

**MuchachoAI**

---

*Built with D3.js and Qlik Sense Extension API*

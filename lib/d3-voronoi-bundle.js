/**
 * d3-voronoi-bundle.js
 * v23 - All-in-one bundle with inline library code
 * Combines d3, d3-weighted-voronoi, d3-voronoi-map, d3-voronoi-treemap
 */
define(['./d3.v7.min'], function(d3) {
    'use strict';

    // Set d3 on window for the libraries to attach to
    window.d3 = d3;

    if (window.VORONOI_DEBUG) { console.log('[d3-voronoi-bundle] v23 - Starting inline library loading'); }

    //=============================================================================
    // d3-weighted-voronoi (inline)
    //=============================================================================
    (function(exports, d3Array, d3Polygon) {
        'use strict';

        var epsilon = 1e-10;

        function epsilonesque(n) {
            return n <= epsilon && n >= -epsilon;
        }

        function dot(v0, v1) {
            return v0.x * v1.x + v0.y * v1.y + v0.z * v1.z;
        }

        function linearDependent(v0, v1) {
            return (
                epsilonesque(v0.x * v1.y - v0.y * v1.x) &&
                epsilonesque(v0.y * v1.z - v0.z * v1.y) &&
                epsilonesque(v0.z * v1.x - v0.x * v1.z)
            );
        }

        function polygonDirection(polygon) {
            var sign, crossproduct, p0, p1, p2, v0, v1, i;
            p0 = polygon[polygon.length - 2];
            p1 = polygon[polygon.length - 1];
            p2 = polygon[0];
            v0 = vect(p0, p1);
            v1 = vect(p1, p2);
            crossproduct = calculateCrossproduct(v0, v1);
            sign = Math.sign(crossproduct);

            p0 = p1;
            p1 = p2;
            p2 = polygon[1];
            v0 = v1;
            v1 = vect(p1, p2);
            crossproduct = calculateCrossproduct(v0, v1);
            if (Math.sign(crossproduct) !== sign) {
                return undefined;
            }

            for (i = 2; i < polygon.length - 1; i++) {
                p0 = p1;
                p1 = p2;
                p2 = polygon[i];
                v0 = v1;
                v1 = vect(p1, p2);
                crossproduct = calculateCrossproduct(v0, v1);
                if (Math.sign(crossproduct) !== sign) {
                    return undefined;
                }
            }
            return sign;
        }

        function vect(from, to) {
            return [to[0] - from[0], to[1] - from[1]];
        }

        function calculateCrossproduct(v0, v1) {
            return v0[0] * v1[1] - v0[1] * v1[0];
        }

        function ConflictListNode(face, vert) {
            this.face = face;
            this.vert = vert;
            this.nextf = null;
            this.prevf = null;
            this.nextv = null;
            this.prevv = null;
        }

        function ConflictList(forFace) {
            this.forFace = forFace;
            this.head = null;
        }

        ConflictList.prototype.add = function(cln) {
            if (this.head === null) {
                this.head = cln;
            } else {
                if (this.forFace) {
                    this.head.prevv = cln;
                    cln.nextv = this.head;
                    this.head = cln;
                } else {
                    this.head.prevf = cln;
                    cln.nextf = this.head;
                    this.head = cln;
                }
            }
        };

        ConflictList.prototype.isEmpty = function() {
            return this.head === null;
        };

        ConflictList.prototype.fill = function(visible) {
            if (this.forFace) return;
            var curr = this.head;
            do {
                visible.push(curr.face);
                curr.face.marked = true;
                curr = curr.nextf;
            } while (curr !== null);
        };

        ConflictList.prototype.removeAll = function() {
            if (this.forFace) {
                var curr = this.head;
                do {
                    if (curr.prevf === null) {
                        if (curr.nextf === null) {
                            curr.vert.conflicts.head = null;
                        } else {
                            curr.nextf.prevf = null;
                            curr.vert.conflicts.head = curr.nextf;
                        }
                    } else {
                        if (curr.nextf != null) {
                            curr.nextf.prevf = curr.prevf;
                        }
                        curr.prevf.nextf = curr.nextf;
                    }
                    curr = curr.nextv;
                    if (curr != null) {
                        curr.prevv = null;
                    }
                } while (curr != null);
            } else {
                var curr = this.head;
                do {
                    if (curr.prevv == null) {
                        if (curr.nextv == null) {
                            curr.face.conflicts.head = null;
                        } else {
                            curr.nextv.prevv = null;
                            curr.face.conflicts.head = curr.nextv;
                        }
                    } else {
                        if (curr.nextv != null) {
                            curr.nextv.prevv = curr.prevv;
                        }
                        curr.prevv.nextv = curr.nextv;
                    }
                    curr = curr.nextf;
                    if (curr != null) curr.prevf = null;
                } while (curr != null);
            }
        };

        ConflictList.prototype.getVertices = function() {
            var list = [], curr = this.head;
            while (curr !== null) {
                list.push(curr.vert);
                curr = curr.nextv;
            }
            return list;
        };

        function Vertex(x, y, z, weight, orig, isDummy) {
            this.x = x;
            this.y = y;
            this.weight = epsilon;
            this.index = 0;
            this.conflicts = new ConflictList(false);
            this.neighbours = null;
            this.nonClippedPolygon = null;
            this.polygon = null;
            this.originalObject = null;
            this.isDummy = false;

            if (orig !== undefined) this.originalObject = orig;
            if (isDummy != undefined) this.isDummy = isDummy;
            if (weight != null) this.weight = weight;
            if (z != null) {
                this.z = z;
            } else {
                this.z = this.projectZ(this.x, this.y, this.weight);
            }
        }

        Vertex.prototype.projectZ = function(x, y, weight) {
            return ((x * x) + (y * y) - weight);
        };

        Vertex.prototype.setWeight = function(weight) {
            this.weight = weight;
            this.z = this.projectZ(this.x, this.y, this.weight);
        };

        Vertex.prototype.subtract = function(v) {
            return new Vertex(v.x - this.x, v.y - this.y, v.z - this.z);
        };

        Vertex.prototype.crossproduct = function(v) {
            return new Vertex((this.y * v.z) - (this.z * v.y), (this.z * v.x) - (this.x * v.z), (this.x * v.y) - (this.y * v.x));
        };

        Vertex.prototype.equals = function(v) {
            return (this.x === v.x && this.y === v.y && this.z === v.z);
        };

        function Plane3D(face) {
            var p1 = face.verts[0];
            var p2 = face.verts[1];
            var p3 = face.verts[2];
            this.a = p1.y * (p2.z - p3.z) + p2.y * (p3.z - p1.z) + p3.y * (p1.z - p2.z);
            this.b = p1.z * (p2.x - p3.x) + p2.z * (p3.x - p1.x) + p3.z * (p1.x - p2.x);
            this.c = p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y);
            this.d = -1 * (p1.x * (p2.y * p3.z - p3.y * p2.z) + p2.x * (p3.y * p1.z - p1.y * p3.z) + p3.x * (p1.y * p2.z - p2.y * p1.z));
        }

        Plane3D.prototype.getNormZPlane = function() {
            return [-1 * (this.a / this.c), -1 * (this.b / this.c), -1 * (this.d / this.c)];
        };

        Plane3D.prototype.getDualPointMappedToPlane = function() {
            var nplane = this.getNormZPlane();
            return new Point2D(nplane[0] / 2, nplane[1] / 2);
        };

        function Point2D(x, y) {
            this.x = x;
            this.y = y;
        }

        function Vector(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }

        Vector.prototype.negate = function() {
            this.x *= -1;
            this.y *= -1;
            this.z *= -1;
        };

        Vector.prototype.normalize = function() {
            var length = Math.sqrt((this.x * this.x) + (this.y * this.y) + (this.z * this.z));
            if (length > 0) {
                this.x /= length;
                this.y /= length;
                this.z /= length;
            }
        };

        function HEdge(orig, dest, face) {
            this.next = null;
            this.prev = null;
            this.twin = null;
            this.orig = orig;
            this.dest = dest;
            this.iFace = face;
        }

        HEdge.prototype.isHorizon = function() {
            return this.twin !== null && !this.iFace.marked && this.twin.iFace.marked;
        };

        HEdge.prototype.findHorizon = function(horizon) {
            if (this.isHorizon()) {
                if (horizon.length > 0 && this === horizon[0]) return;
                horizon.push(this);
                this.next.findHorizon(horizon);
            } else {
                if (this.twin !== null) this.twin.next.findHorizon(horizon);
            }
        };

        HEdge.prototype.isEqual = function(origin, dest) {
            return ((this.orig.equals(origin) && this.dest.equals(dest)) || (this.orig.equals(dest) && this.dest.equals(origin)));
        };

        function d3WeightedVoronoiError(message) {
            this.message = message;
            this.stack = new Error().stack;
        }
        d3WeightedVoronoiError.prototype.name = 'd3WeightedVoronoiError';
        d3WeightedVoronoiError.prototype = new Error();

        function Face(a, b, c, orient) {
            this.conflicts = new ConflictList(true);
            this.verts = [a, b, c];
            this.marked = false;
            var t = a.subtract(b).crossproduct(b.subtract(c));
            this.normal = new Vector(-t.x, -t.y, -t.z);
            this.normal.normalize();
            this.createEdges();
            this.dualPoint = null;
            if (orient != undefined) this.orient(orient);
        }

        Face.prototype.getDualPoint = function() {
            if (this.dualPoint == null) {
                var plane3d = new Plane3D(this);
                this.dualPoint = plane3d.getDualPointMappedToPlane();
            }
            return this.dualPoint;
        };

        Face.prototype.isVisibleFromBelow = function() {
            return this.normal.z < -1.4259414393190911e-9;
        };

        Face.prototype.createEdges = function() {
            this.edges = [];
            this.edges[0] = new HEdge(this.verts[0], this.verts[1], this);
            this.edges[1] = new HEdge(this.verts[1], this.verts[2], this);
            this.edges[2] = new HEdge(this.verts[2], this.verts[0], this);
            this.edges[0].next = this.edges[1];
            this.edges[0].prev = this.edges[2];
            this.edges[1].next = this.edges[2];
            this.edges[1].prev = this.edges[0];
            this.edges[2].next = this.edges[0];
            this.edges[2].prev = this.edges[1];
        };

        Face.prototype.orient = function(orient) {
            if (!(dot(this.normal, orient) < dot(this.normal, this.verts[0]))) {
                var temp = this.verts[1];
                this.verts[1] = this.verts[2];
                this.verts[2] = temp;
                this.normal.negate();
                this.createEdges();
            }
        };

        Face.prototype.getEdge = function(v0, v1) {
            for (var i = 0; i < 3; i++) {
                if (this.edges[i].isEqual(v0, v1)) return this.edges[i];
            }
            return null;
        };

        Face.prototype.link = function(face, v0, v1) {
            if (face instanceof Face) {
                var twin = face.getEdge(v0, v1);
                if (twin === null) throw new d3WeightedVoronoiError('when linking, twin is null');
                var edge = this.getEdge(v0, v1);
                if (edge === null) throw new d3WeightedVoronoiError('when linking, twin is null');
                twin.twin = edge;
                edge.twin = twin;
            } else {
                var twin = face;
                var edge = this.getEdge(twin.orig, twin.dest);
                twin.twin = edge;
                edge.twin = twin;
            }
        };

        Face.prototype.conflict = function(v) {
            return dot(this.normal, v) > dot(this.normal, this.verts[0]) + epsilon;
        };

        Face.prototype.getHorizon = function() {
            for (var i = 0; i < 3; i++) {
                if (this.edges[i].twin !== null && this.edges[i].twin.isHorizon()) return this.edges[i];
            }
            return null;
        };

        Face.prototype.removeConflict = function() {
            this.conflicts.removeAll();
        };

        function ConvexHull() {
            this.points = [];
            this.facets = [];
            this.created = [];
            this.horizon = [];
            this.visible = [];
            this.current = 0;
        }

        ConvexHull.prototype.init = function(boundingSites, sites) {
            this.points = [];
            for (var i = 0; i < sites.length; i++) {
                this.points[i] = new Vertex(sites[i].x, sites[i].y, sites[i].z, null, sites[i], false);
            }
            this.points = this.points.concat(boundingSites);
        };

        ConvexHull.prototype.permutate = function() {
            var pointSize = this.points.length;
            for (var i = pointSize - 1; i > 0; i--) {
                var ra = Math.floor(Math.random() * i);
                var temp = this.points[ra];
                temp.index = i;
                var currentItem = this.points[i];
                currentItem.index = ra;
                this.points.splice(ra, 1, currentItem);
                this.points.splice(i, 1, temp);
            }
        };

        ConvexHull.prototype.prep = function() {
            if (this.points.length <= 3) throw new d3WeightedVoronoiError('Less than 4 points');
            for (var i = 0; i < this.points.length; i++) this.points[i].index = i;

            var v0, v1, v2, v3, f1, f2, f3, f0;
            v0 = this.points[0];
            v1 = this.points[1];
            v2 = v3 = null;

            for (var i = 2; i < this.points.length; i++) {
                if (!(linearDependent(v0, this.points[i]) && linearDependent(v1, this.points[i]))) {
                    v2 = this.points[i];
                    v2.index = 2;
                    this.points[2].index = i;
                    this.points.splice(i, 1, this.points[2]);
                    this.points.splice(2, 1, v2);
                    break;
                }
            }
            if (v2 === null) throw new d3WeightedVoronoiError('Not enough non-planar Points (v2 is null)');

            f0 = new Face(v0, v1, v2);
            for (var i = 3; i < this.points.length; i++) {
                if (!epsilonesque(dot(f0.normal, f0.verts[0]) - dot(f0.normal, this.points[i]))) {
                    v3 = this.points[i];
                    v3.index = 3;
                    this.points[3].index = i;
                    this.points.splice(i, 1, this.points[3]);
                    this.points.splice(3, 1, v3);
                    break;
                }
            }
            if (v3 === null) throw new d3WeightedVoronoiError('Not enough non-planar Points (v3 is null)');

            f0.orient(v3);
            f1 = new Face(v0, v2, v3, v1);
            f2 = new Face(v0, v1, v3, v2);
            f3 = new Face(v1, v2, v3, v0);
            this.addFacet(f0);
            this.addFacet(f1);
            this.addFacet(f2);
            this.addFacet(f3);
            f0.link(f1, v0, v2);
            f0.link(f2, v0, v1);
            f0.link(f3, v1, v2);
            f1.link(f2, v0, v3);
            f1.link(f3, v2, v3);
            f2.link(f3, v3, v1);
            this.current = 4;

            var v;
            for (var i = this.current; i < this.points.length; i++) {
                v = this.points[i];
                if (f0.conflict(v)) this.addConflict(f0, v);
                if (f1.conflict(v)) this.addConflict(f1, v);
                if (f2.conflict(v)) this.addConflict(f2, v);
                if (f3.conflict(v)) this.addConflict(f3, v);
            }
        };

        ConvexHull.prototype.addConflicts = function(old1, old2, fn) {
            var l1 = old1.conflicts.getVertices();
            var l2 = old2.conflicts.getVertices();
            var nCL = [];
            var v1, v2, i = 0, l = 0;

            while (i < l1.length || l < l2.length) {
                if (i < l1.length && l < l2.length) {
                    v1 = l1[i];
                    v2 = l2[l];
                    if (v1.index === v2.index) {
                        nCL.push(v1);
                        i++;
                        l++;
                    } else if (v1.index > v2.index) {
                        nCL.push(v1);
                        i++;
                    } else {
                        nCL.push(v2);
                        l++;
                    }
                } else if (i < l1.length) {
                    nCL.push(l1[i++]);
                } else {
                    nCL.push(l2[l++]);
                }
            }
            for (var i = nCL.length - 1; i >= 0; i--) {
                v1 = nCL[i];
                if (fn.conflict(v1)) this.addConflict(fn, v1);
            }
        };

        ConvexHull.prototype.addConflict = function(face, vert) {
            var e = new ConflictListNode(face, vert);
            face.conflicts.add(e);
            vert.conflicts.add(e);
        };

        ConvexHull.prototype.removeConflict = function(f) {
            f.removeConflict();
            var index = f.index;
            f.index = -1;
            if (index === this.facets.length - 1) {
                this.facets.splice(this.facets.length - 1, 1);
                return;
            }
            if (index >= this.facets.length || index < 0) return;
            var last = this.facets.splice(this.facets.length - 1, 1);
            last[0].index = index;
            this.facets.splice(index, 1, last[0]);
        };

        ConvexHull.prototype.addFacet = function(face) {
            face.index = this.facets.length;
            this.facets.push(face);
        };

        ConvexHull.prototype.compute = function() {
            this.prep();
            while (this.current < this.points.length) {
                var next = this.points[this.current];
                if (next.conflicts.isEmpty()) {
                    this.current++;
                    continue;
                }
                this.created = [];
                this.horizon = [];
                this.visible = [];
                next.conflicts.fill(this.visible);
                var e;
                for (var jF = 0; jF < this.visible.length; jF++) {
                    e = this.visible[jF].getHorizon();
                    if (e !== null) {
                        e.findHorizon(this.horizon);
                        break;
                    }
                }
                var last = null, first = null;
                for (var hEi = 0; hEi < this.horizon.length; hEi++) {
                    var hE = this.horizon[hEi];
                    var fn = new Face(next, hE.orig, hE.dest, hE.twin.next.dest);
                    fn.conflicts = new ConflictList(true);
                    this.addFacet(fn);
                    this.created.push(fn);
                    this.addConflicts(hE.iFace, hE.twin.iFace, fn);
                    fn.link(hE);
                    if (last !== null) fn.link(last, next, hE.orig);
                    last = fn;
                    if (first === null) first = fn;
                }
                if (first !== null && last !== null) {
                    last.link(first, next, this.horizon[0].orig);
                }
                if (this.created.length != 0) {
                    for (var f = 0; f < this.visible.length; f++) {
                        this.removeConflict(this.visible[f]);
                    }
                    this.current++;
                    this.created = [];
                }
            }
            return this.facets;
        };

        ConvexHull.prototype.clear = function() {
            this.points = [];
            this.facets = [];
            this.created = [];
            this.horizon = [];
            this.visible = [];
            this.current = 0;
        };

        function polygonClip(clip, subject) {
            var input, closed = polygonClosed(subject), i = -1, n = clip.length - polygonClosed(clip), j, m, a = clip[n - 1], b, c, d, intersection;

            while (++i < n) {
                input = subject.slice();
                subject.length = 0;
                b = clip[i];
                c = input[(m = input.length - closed) - 1];
                j = -1;
                while (++j < m) {
                    d = input[j];
                    if (polygonInside(d, a, b)) {
                        if (!polygonInside(c, a, b)) {
                            intersection = polygonIntersect(c, d, a, b);
                            if (isFinite(intersection[0])) subject.push(intersection);
                        }
                        subject.push(d);
                    } else if (polygonInside(c, a, b)) {
                        intersection = polygonIntersect(c, d, a, b);
                        if (isFinite(intersection[0])) subject.push(intersection);
                    }
                    c = d;
                }
                if (closed) subject.push(subject[0]);
                a = b;
            }
            return subject;
        }

        function polygonInside(p, a, b) {
            return (b[0] - a[0]) * (p[1] - a[1]) < (b[1] - a[1]) * (p[0] - a[0]);
        }

        function polygonIntersect(c, d, a, b) {
            var x1 = c[0], x3 = a[0], x21 = d[0] - x1, x43 = b[0] - x3, y1 = c[1], y3 = a[1], y21 = d[1] - y1, y43 = b[1] - y3, ua = (x43 * (y1 - y3) - y43 * (x1 - x3)) / (y43 * x21 - x43 * y21);
            return [x1 + ua * x21, y1 + ua * y21];
        }

        function polygonClosed(coordinates) {
            var a = coordinates[0], b = coordinates[coordinates.length - 1];
            return !(a[0] - b[0] || a[1] - b[1]);
        }

        function getFacesOfDestVertex(edge) {
            var faces = [];
            var previous = edge;
            var first = edge.dest;
            var site = first.originalObject;
            var neighbours = [];
            do {
                previous = previous.twin.prev;
                var siteOrigin = previous.orig.originalObject;
                if (!siteOrigin.isDummy) neighbours.push(siteOrigin);
                var iFace = previous.iFace;
                if (iFace.isVisibleFromBelow()) faces.push(iFace);
            } while (previous !== edge);
            site.neighbours = neighbours;
            return faces;
        }

        function computePowerDiagramIntegrated(sites, boundingSites, clippingPolygon) {
            var convexHull = new ConvexHull();
            convexHull.clear();
            convexHull.init(boundingSites, sites);

            var facets = convexHull.compute(sites);
            var polygons = [];
            var verticesVisited = [];
            var facetCount = facets.length;

            for (var i = 0; i < facetCount; i++) {
                var facet = facets[i];
                if (facet.isVisibleFromBelow()) {
                    for (var e = 0; e < 3; e++) {
                        var edge = facet.edges[e];
                        var destVertex = edge.dest;
                        var site = destVertex.originalObject;

                        if (!verticesVisited[destVertex.index]) {
                            verticesVisited[destVertex.index] = true;
                            if (site.isDummy) continue;
                            var faces = getFacesOfDestVertex(edge);
                            var protopoly = [];
                            var lastX = null, lastY = null, dx = 1, dy = 1;
                            for (var j = 0; j < faces.length; j++) {
                                var point = faces[j].getDualPoint();
                                var x1 = point.x, y1 = point.y;
                                if (lastX !== null) {
                                    dx = lastX - x1;
                                    dy = lastY - y1;
                                    if (dx < 0) dx = -dx;
                                    if (dy < 0) dy = -dy;
                                }
                                if (dx > epsilon || dy > epsilon) {
                                    protopoly.push([x1, y1]);
                                    lastX = x1;
                                    lastY = y1;
                                }
                            }

                            site.nonClippedPolygon = protopoly.reverse();
                            if (!site.isDummy && d3Polygon.polygonLength(site.nonClippedPolygon) > 0) {
                                var clippedPoly = polygonClip(clippingPolygon, site.nonClippedPolygon);
                                site.polygon = clippedPoly;
                                clippedPoly.site = site;
                                if (clippedPoly.length > 0) polygons.push(clippedPoly);
                            }
                        }
                    }
                }
            }
            return polygons;
        }

        function weightedVoronoi() {
            var x = function(d) { return d.x; };
            var y = function(d) { return d.y; };
            var weight = function(d) { return d.weight; };
            var clip = [[0, 0], [0, 1], [1, 1], [1, 0]];
            var extent = [[0, 0], [1, 1]];
            var size = [1, 1];

            function _weightedVoronoi(data) {
                var formatedSites = data.map(function(d) {
                    return new Vertex(x(d), y(d), null, weight(d), d, false);
                });
                return computePowerDiagramIntegrated(formatedSites, boundingSites(), clip);
            }

            _weightedVoronoi.x = function(_) {
                if (!arguments.length) return x;
                x = _;
                return _weightedVoronoi;
            };

            _weightedVoronoi.y = function(_) {
                if (!arguments.length) return y;
                y = _;
                return _weightedVoronoi;
            };

            _weightedVoronoi.weight = function(_) {
                if (!arguments.length) return weight;
                weight = _;
                return _weightedVoronoi;
            };

            _weightedVoronoi.clip = function(_) {
                var direction, xExtent, yExtent;
                if (!arguments.length) return clip;
                xExtent = d3Array.extent(_.map(function(c) { return c[0]; }));
                yExtent = d3Array.extent(_.map(function(c) { return c[1]; }));
                direction = polygonDirection(_);
                if (direction === undefined) {
                    clip = d3Polygon.polygonHull(_);
                } else if (direction === 1) {
                    clip = _.reverse();
                } else {
                    clip = _;
                }
                extent = [[xExtent[0], yExtent[0]], [xExtent[1], yExtent[1]]];
                size = [xExtent[1] - xExtent[0], yExtent[1] - yExtent[0]];
                return _weightedVoronoi;
            };

            _weightedVoronoi.extent = function(_) {
                if (!arguments.length) return extent;
                clip = [_[0], [_[0][0], _[1][1]], _[1], [_[1][0], _[0][1]]];
                extent = _;
                size = [_[1][0] - _[0][0], _[1][1] - _[0][1]];
                return _weightedVoronoi;
            };

            _weightedVoronoi.size = function(_) {
                if (!arguments.length) return size;
                clip = [[0, 0], [0, _[1]], [_[0], _[1]], [_[0], 0]];
                extent = [[0, 0], _];
                size = _;
                return _weightedVoronoi;
            };

            function boundingSites() {
                var minX, maxX, minY, maxY, width, height, x0, x1, y0, y1, boundingData = [], boundingSites = [];
                minX = extent[0][0];
                maxX = extent[1][0];
                minY = extent[0][1];
                maxY = extent[1][1];
                width = maxX - minX;
                height = maxY - minY;
                x0 = minX - width;
                x1 = maxX + width;
                y0 = minY - height;
                y1 = maxY + height;
                boundingData[0] = [x0, y0];
                boundingData[1] = [x0, y1];
                boundingData[2] = [x1, y1];
                boundingData[3] = [x1, y0];
                for (var i = 0; i < 4; i++) {
                    boundingSites.push(new Vertex(boundingData[i][0], boundingData[i][1], null, epsilon, new Vertex(boundingData[i][0], boundingData[i][1], null, epsilon, null, true), true));
                }
                return boundingSites;
            }

            return _weightedVoronoi;
        }

        exports.weightedVoronoi = weightedVoronoi;
        exports.d3WeightedVoronoiError = d3WeightedVoronoiError;
    })(d3, d3, d3);

    if (window.VORONOI_DEBUG) { console.log('[d3-voronoi-bundle] d3.weightedVoronoi:', typeof d3.weightedVoronoi); }

    //=============================================================================
    // d3-voronoi-map (inline)
    //=============================================================================
    (function(exports, d3Polygon, d3Timer, d3Dispatch, d3WeightedVoronoi) {
        'use strict';

        var DEFAULT_LENGTH = 10;

        function FlickeringMitigation() {
            this.growthChangesLength = DEFAULT_LENGTH;
            this.totalAvailableArea = NaN;
            this.lastAreaError = NaN;
            this.lastGrowth = NaN;
            this.growthChanges = [];
            this.growthChangeWeights = generateGrowthChangeWeights(this.growthChangesLength);
            this.growthChangeWeightsSum = computeGrowthChangeWeightsSum(this.growthChangeWeights);
        }

        function direction(h0, h1) {
            return (h0 >= h1) ? 1 : -1;
        }

        function generateGrowthChangeWeights(length) {
            var initialWeight = 3, weightDecrement = 1, minWeight = 1;
            var weightedCount = initialWeight, growthChangeWeights = [];
            for (var i = 0; i < length; i++) {
                growthChangeWeights.push(weightedCount);
                weightedCount -= weightDecrement;
                if (weightedCount < minWeight) weightedCount = minWeight;
            }
            return growthChangeWeights;
        }

        function computeGrowthChangeWeightsSum(growthChangeWeights) {
            var sum = 0;
            for (var i = 0; i < growthChangeWeights.length; i++) sum += growthChangeWeights[i];
            return sum;
        }

        FlickeringMitigation.prototype.reset = function() {
            this.lastAreaError = NaN;
            this.lastGrowth = NaN;
            this.growthChanges = [];
            this.growthChangesLength = DEFAULT_LENGTH;
            this.growthChangeWeights = generateGrowthChangeWeights(this.growthChangesLength);
            this.growthChangeWeightsSum = computeGrowthChangeWeightsSum(this.growthChangeWeights);
            this.totalAvailableArea = NaN;
            return this;
        };

        FlickeringMitigation.prototype.clear = function() {
            this.lastAreaError = NaN;
            this.lastGrowth = NaN;
            this.growthChanges = [];
            return this;
        };

        FlickeringMitigation.prototype.length = function(_) {
            if (!arguments.length) return this.growthChangesLength;
            if (parseInt(_) > 0) {
                this.growthChangesLength = Math.floor(parseInt(_));
                this.growthChangeWeights = generateGrowthChangeWeights(this.growthChangesLength);
                this.growthChangeWeightsSum = computeGrowthChangeWeightsSum(this.growthChangeWeights);
            }
            return this;
        };

        FlickeringMitigation.prototype.totalArea = function(_) {
            if (!arguments.length) return this.totalAvailableArea;
            if (parseFloat(_) > 0) this.totalAvailableArea = parseFloat(_);
            return this;
        };

        FlickeringMitigation.prototype.add = function(areaError) {
            var secondToLastAreaError, secondToLastGrowth;
            secondToLastAreaError = this.lastAreaError;
            this.lastAreaError = areaError;
            if (!isNaN(secondToLastAreaError)) {
                secondToLastGrowth = this.lastGrowth;
                this.lastGrowth = direction(this.lastAreaError, secondToLastAreaError);
            }
            if (!isNaN(secondToLastGrowth)) {
                this.growthChanges.unshift(this.lastGrowth != secondToLastGrowth);
            }
            if (this.growthChanges.length > this.growthChangesLength) this.growthChanges.pop();
            return this;
        };

        FlickeringMitigation.prototype.ratio = function() {
            var weightedChangeCount = 0, ratio;
            if (this.growthChanges.length < this.growthChangesLength) return 0;
            if (this.lastAreaError > this.totalAvailableArea / 10) return 0;
            for (var i = 0; i < this.growthChangesLength; i++) {
                if (this.growthChanges[i]) weightedChangeCount += this.growthChangeWeights[i];
            }
            ratio = weightedChangeCount / this.growthChangeWeightsSum;
            return ratio;
        };

        function randomInitialPosition() {
            var clippingPolygon, extent, minX, maxX, minY, maxY, dx, dy;

            function _random(d, i, arr, voronoiMapSimulation) {
                var shouldUpdateInternals = false, x, y;
                if (clippingPolygon !== voronoiMapSimulation.clip()) {
                    clippingPolygon = voronoiMapSimulation.clip();
                    extent = voronoiMapSimulation.extent();
                    shouldUpdateInternals = true;
                }
                if (shouldUpdateInternals) updateInternals();
                x = minX + dx * voronoiMapSimulation.prng()();
                y = minY + dy * voronoiMapSimulation.prng()();
                while (!d3Polygon.polygonContains(clippingPolygon, [x, y])) {
                    x = minX + dx * voronoiMapSimulation.prng()();
                    y = minY + dy * voronoiMapSimulation.prng()();
                }
                return [x, y];
            }

            function updateInternals() {
                minX = extent[0][0];
                maxX = extent[1][0];
                minY = extent[0][1];
                maxY = extent[1][1];
                dx = maxX - minX;
                dy = maxY - minY;
            }

            return _random;
        }

        function pie() {
            var startAngle = 0;
            var clippingPolygon, dataArray, dataArrayLength, clippingPolygonCentroid, halfIncircleRadius, angleBetweenData;

            function _pie(d, i, arr, voronoiMapSimulation) {
                var shouldUpdateInternals = false;
                if (clippingPolygon !== voronoiMapSimulation.clip()) {
                    clippingPolygon = voronoiMapSimulation.clip();
                    shouldUpdateInternals |= true;
                }
                if (dataArray !== arr) {
                    dataArray = arr;
                    shouldUpdateInternals |= true;
                }
                if (shouldUpdateInternals) updateInternals();
                return [
                    clippingPolygonCentroid[0] + Math.cos(startAngle + i * angleBetweenData) * halfIncircleRadius + (voronoiMapSimulation.prng()() - 0.5) * 1E-3,
                    clippingPolygonCentroid[1] + Math.sin(startAngle + i * angleBetweenData) * halfIncircleRadius + (voronoiMapSimulation.prng()() - 0.5) * 1E-3
                ];
            }

            _pie.startAngle = function(_) {
                if (!arguments.length) return startAngle;
                startAngle = _;
                return _pie;
            };

            function updateInternals() {
                clippingPolygonCentroid = d3Polygon.polygonCentroid(clippingPolygon);
                halfIncircleRadius = computeMinDistFromEdges(clippingPolygonCentroid, clippingPolygon) / 2;
                dataArrayLength = dataArray.length;
                angleBetweenData = 2 * Math.PI / dataArrayLength;
            }

            function computeMinDistFromEdges(vertex, clippingPolygon) {
                var minDistFromEdges = Infinity, edgeIndex = 0, edgeVertex0 = clippingPolygon[clippingPolygon.length - 1], edgeVertex1 = clippingPolygon[edgeIndex];
                var distFromCurrentEdge;
                while (edgeIndex < clippingPolygon.length) {
                    distFromCurrentEdge = vDistance(vertex, edgeVertex0, edgeVertex1);
                    if (distFromCurrentEdge < minDistFromEdges) minDistFromEdges = distFromCurrentEdge;
                    edgeIndex++;
                    edgeVertex0 = edgeVertex1;
                    edgeVertex1 = clippingPolygon[edgeIndex];
                }
                return minDistFromEdges;
            }

            function vDistance(vertex, edgeVertex0, edgeVertex1) {
                var x = vertex[0], y = vertex[1], x1 = edgeVertex0[0], y1 = edgeVertex0[1], x2 = edgeVertex1[0], y2 = edgeVertex1[1];
                var A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
                var dot = A * C + B * D, len_sq = C * C + D * D, param = -1;
                if (len_sq != 0) param = dot / len_sq;
                var xx, yy;
                if (param < 0) { xx = x1; yy = y1; }
                else if (param > 1) { xx = x2; yy = y2; }
                else { xx = x1 + param * C; yy = y1 + param * D; }
                var dx = x - xx, dy = y - yy;
                return Math.sqrt(dx * dx + dy * dy);
            }

            return _pie;
        }

        function halfAverageAreaInitialWeight() {
            var clippingPolygon, dataArray, siteCount, totalArea, halfAverageArea;

            function _halfAverageArea(d, i, arr, voronoiMapSimulation) {
                var shouldUpdateInternals = false;
                if (clippingPolygon !== voronoiMapSimulation.clip()) {
                    clippingPolygon = voronoiMapSimulation.clip();
                    shouldUpdateInternals |= true;
                }
                if (dataArray !== arr) {
                    dataArray = arr;
                    shouldUpdateInternals |= true;
                }
                if (shouldUpdateInternals) updateInternals();
                return halfAverageArea;
            }

            function updateInternals() {
                siteCount = dataArray.length;
                totalArea = d3Polygon.polygonArea(clippingPolygon);
                halfAverageArea = totalArea / siteCount / 2;
            }

            return _halfAverageArea;
        }

        function d3VoronoiMapError(message) {
            this.message = message;
            this.stack = new Error().stack;
        }
        d3VoronoiMapError.prototype.name = 'd3VoronoiMapError';
        d3VoronoiMapError.prototype = new Error();

        function voronoiMapSimulation(data) {
            var DEFAULT_CONVERGENCE_RATIO = 0.01;
            var DEFAULT_MAX_ITERATION_COUNT = 50;
            var DEFAULT_MIN_WEIGHT_RATIO = 0.01;
            var DEFAULT_PRNG = Math.random;
            var DEFAULT_INITIAL_POSITION = randomInitialPosition();
            var DEFAULT_INITIAL_WEIGHT = halfAverageAreaInitialWeight();
            var RANDOM_INITIAL_POSITION = randomInitialPosition();
            var epsilon = 1e-10;

            var weight = function(d) { return d.weight; };
            var convergenceRatio = DEFAULT_CONVERGENCE_RATIO;
            var maxIterationCount = DEFAULT_MAX_ITERATION_COUNT;
            var minWeightRatio = DEFAULT_MIN_WEIGHT_RATIO;
            var prng = DEFAULT_PRNG;
            var initialPosition = DEFAULT_INITIAL_POSITION;
            var initialWeight = DEFAULT_INITIAL_WEIGHT;

            var weightedVoronoi = d3WeightedVoronoi.weightedVoronoi(),
                flickeringMitigation = new FlickeringMitigation(),
                shouldInitialize = true,
                siteCount, totalArea, areaErrorTreshold, iterationCount, polygons, areaError, converged, ended;

            var simulation, stepper = d3Timer.timer(step), event = d3Dispatch.dispatch('tick', 'end');

            var HANDLE_OVERWEIGHTED_VARIANT = 1;
            var HANLDE_OVERWEIGHTED_MAX_ITERATION_COUNT = 1000;
            var handleOverweighted;

            function sqr(d) { return Math.pow(d, 2); }
            function squaredDistance(s0, s1) { return sqr(s1.x - s0.x) + sqr(s1.y - s0.y); }

            simulation = {
                tick: tick,
                restart: function() { stepper.restart(step); return simulation; },
                stop: function() { stepper.stop(); return simulation; },
                weight: function(_) { if (!arguments.length) return weight; weight = _; shouldInitialize = true; return simulation; },
                convergenceRatio: function(_) { if (!arguments.length) return convergenceRatio; convergenceRatio = _; shouldInitialize = true; return simulation; },
                maxIterationCount: function(_) { if (!arguments.length) return maxIterationCount; maxIterationCount = _; return simulation; },
                minWeightRatio: function(_) { if (!arguments.length) return minWeightRatio; minWeightRatio = _; shouldInitialize = true; return simulation; },
                clip: function(_) { if (!arguments.length) return weightedVoronoi.clip(); weightedVoronoi.clip(_); shouldInitialize = true; return simulation; },
                extent: function(_) { if (!arguments.length) return weightedVoronoi.extent(); weightedVoronoi.extent(_); shouldInitialize = true; return simulation; },
                size: function(_) { if (!arguments.length) return weightedVoronoi.size(); weightedVoronoi.size(_); shouldInitialize = true; return simulation; },
                prng: function(_) { if (!arguments.length) return prng; prng = _; shouldInitialize = true; return simulation; },
                initialPosition: function(_) { if (!arguments.length) return initialPosition; initialPosition = _; shouldInitialize = true; return simulation; },
                initialWeight: function(_) { if (!arguments.length) return initialWeight; initialWeight = _; shouldInitialize = true; return simulation; },
                state: function() {
                    if (shouldInitialize) initializeSimulation();
                    return { ended: ended, iterationCount: iterationCount, convergenceRatio: areaError / totalArea, polygons: polygons };
                },
                on: function(name, _) { if (arguments.length === 1) return event.on(name); event.on(name, _); return simulation; }
            };

            function step() {
                tick();
                event.call('tick', simulation);
                if (ended) {
                    stepper.stop();
                    event.call('end', simulation);
                }
            }

            function tick() {
                if (!ended) {
                    if (shouldInitialize) initializeSimulation();
                    polygons = adapt(polygons, flickeringMitigation.ratio());
                    iterationCount++;
                    areaError = computeAreaError(polygons);
                    flickeringMitigation.add(areaError);
                    converged = areaError < areaErrorTreshold;
                    ended = converged || iterationCount >= maxIterationCount;
                }
            }

            function initializeSimulation() {
                setHandleOverweighted();
                siteCount = data.length;
                totalArea = Math.abs(d3Polygon.polygonArea(weightedVoronoi.clip()));
                areaErrorTreshold = convergenceRatio * totalArea;
                flickeringMitigation.clear().totalArea(totalArea);
                iterationCount = 0;
                converged = false;
                polygons = initialize(data, simulation);
                ended = false;
                shouldInitialize = false;
            }

            function initialize(data, simulation) {
                var maxWeight = data.reduce(function(max, d) { return Math.max(max, weight(d)); }, -Infinity),
                    minAllowedWeight = maxWeight * minWeightRatio;
                var weights, mapPoints;

                weights = data.map(function(d, i, arr) {
                    return {
                        index: i,
                        weight: Math.max(weight(d), minAllowedWeight),
                        initialPosition: initialPosition(d, i, arr, simulation),
                        initialWeight: initialWeight(d, i, arr, simulation),
                        originalData: d
                    };
                });

                mapPoints = createMapPoints(weights, simulation);
                handleOverweighted(mapPoints);
                return weightedVoronoi(mapPoints);
            }

            function createMapPoints(basePoints, simulation) {
                var totalWeight = basePoints.reduce(function(acc, bp) { return acc += bp.weight; }, 0);
                var initialPos;

                return basePoints.map(function(bp, i, bps) {
                    initialPos = bp.initialPosition;
                    if (!d3Polygon.polygonContains(weightedVoronoi.clip(), initialPos)) {
                        initialPos = DEFAULT_INITIAL_POSITION(bp, i, bps, simulation);
                    }
                    return {
                        index: bp.index,
                        targetedArea: (totalArea * bp.weight) / totalWeight,
                        data: bp,
                        x: initialPos[0],
                        y: initialPos[1],
                        weight: bp.initialWeight
                    };
                });
            }

            function adapt(polygons, flickeringMitigationRatio) {
                var adaptedMapPoints;
                adaptPositions(polygons, flickeringMitigationRatio);
                adaptedMapPoints = polygons.map(function(p) { return p.site.originalObject; });
                polygons = weightedVoronoi(adaptedMapPoints);
                if (polygons.length < siteCount) throw new d3VoronoiMapError('at least 1 site has no area, which is not supposed to arise');
                adaptWeights(polygons, flickeringMitigationRatio);
                adaptedMapPoints = polygons.map(function(p) { return p.site.originalObject; });
                polygons = weightedVoronoi(adaptedMapPoints);
                if (polygons.length < siteCount) throw new d3VoronoiMapError('at least 1 site has no area, which is not supposed to arise');
                return polygons;
            }

            function adaptPositions(polygons, flickeringMitigationRatio) {
                var newMapPoints = [], flickeringInfluence = 0.5;
                var flickeringMit, d, polygon, mapPoint, centroid, dx, dy;
                flickeringMit = flickeringInfluence * flickeringMitigationRatio;
                d = 1 - flickeringMit;
                for (var i = 0; i < siteCount; i++) {
                    polygon = polygons[i];
                    mapPoint = polygon.site.originalObject;
                    centroid = d3Polygon.polygonCentroid(polygon);
                    dx = centroid[0] - mapPoint.x;
                    dy = centroid[1] - mapPoint.y;
                    dx *= d;
                    dy *= d;
                    mapPoint.x += dx;
                    mapPoint.y += dy;
                    newMapPoints.push(mapPoint);
                }
                handleOverweighted(newMapPoints);
            }

            function adaptWeights(polygons, flickeringMitigationRatio) {
                var newMapPoints = [], flickeringInfluence = 0.1;
                var flickeringMit, polygon, mapPoint, currentArea, adaptRatio, adaptedWeight;
                flickeringMit = flickeringInfluence * flickeringMitigationRatio;
                for (var i = 0; i < siteCount; i++) {
                    polygon = polygons[i];
                    mapPoint = polygon.site.originalObject;
                    currentArea = d3Polygon.polygonArea(polygon);
                    adaptRatio = mapPoint.targetedArea / currentArea;
                    adaptRatio = Math.max(adaptRatio, 1 - flickeringInfluence + flickeringMit);
                    adaptRatio = Math.min(adaptRatio, 1 + flickeringInfluence - flickeringMit);
                    adaptedWeight = mapPoint.weight * adaptRatio;
                    adaptedWeight = Math.max(adaptedWeight, epsilon);
                    mapPoint.weight = adaptedWeight;
                    newMapPoints.push(mapPoint);
                }
                handleOverweighted(newMapPoints);
            }

            function handleOverweighted0(mapPoints) {
                var fixCount = 0;
                var fixApplied, tpi, tpj, weightest, lightest, sqrD, adaptedWeight;
                do {
                    if (fixCount > HANLDE_OVERWEIGHTED_MAX_ITERATION_COUNT) throw new d3VoronoiMapError('handleOverweighted0 is looping too much');
                    fixApplied = false;
                    for (var i = 0; i < siteCount; i++) {
                        tpi = mapPoints[i];
                        for (var j = i + 1; j < siteCount; j++) {
                            tpj = mapPoints[j];
                            if (tpi.weight > tpj.weight) { weightest = tpi; lightest = tpj; }
                            else { weightest = tpj; lightest = tpi; }
                            sqrD = squaredDistance(tpi, tpj);
                            if (sqrD < weightest.weight - lightest.weight) {
                                adaptedWeight = sqrD + lightest.weight / 2;
                                adaptedWeight = Math.max(adaptedWeight, epsilon);
                                weightest.weight = adaptedWeight;
                                fixApplied = true;
                                fixCount++;
                                break;
                            }
                        }
                        if (fixApplied) break;
                    }
                } while (fixApplied);
            }

            function handleOverweighted1(mapPoints) {
                var fixCount = 0;
                var fixApplied, tpi, tpj, weightest, lightest, sqrD, overweight;
                do {
                    if (fixCount > HANLDE_OVERWEIGHTED_MAX_ITERATION_COUNT) throw new d3VoronoiMapError('handleOverweighted1 is looping too much');
                    fixApplied = false;
                    for (var i = 0; i < siteCount; i++) {
                        tpi = mapPoints[i];
                        for (var j = i + 1; j < siteCount; j++) {
                            tpj = mapPoints[j];
                            if (tpi.weight > tpj.weight) { weightest = tpi; lightest = tpj; }
                            else { weightest = tpj; lightest = tpi; }
                            sqrD = squaredDistance(tpi, tpj);
                            if (sqrD < weightest.weight - lightest.weight) {
                                overweight = weightest.weight - lightest.weight - sqrD;
                                lightest.weight += overweight + epsilon;
                                fixApplied = true;
                                fixCount++;
                                break;
                            }
                        }
                        if (fixApplied) break;
                    }
                } while (fixApplied);
            }

            function computeAreaError(polygons) {
                var areaErrorSum = 0, polygon, mapPoint, currentArea;
                for (var i = 0; i < siteCount; i++) {
                    polygon = polygons[i];
                    mapPoint = polygon.site.originalObject;
                    currentArea = d3Polygon.polygonArea(polygon);
                    areaErrorSum += Math.abs(mapPoint.targetedArea - currentArea);
                }
                return areaErrorSum;
            }

            function setHandleOverweighted() {
                switch (HANDLE_OVERWEIGHTED_VARIANT) {
                    case 0: handleOverweighted = handleOverweighted0; break;
                    case 1: handleOverweighted = handleOverweighted1; break;
                    default: handleOverweighted = handleOverweighted0;
                }
            }

            return simulation;
        }

        exports.voronoiMapSimulation = voronoiMapSimulation;
        exports.voronoiMapInitialPositionRandom = randomInitialPosition;
        exports.voronoiMapInitialPositionPie = pie;
        exports.d3VoronoiMapError = d3VoronoiMapError;
    })(d3, d3, d3, d3, d3);

    if (window.VORONOI_DEBUG) { console.log('[d3-voronoi-bundle] d3.voronoiMapSimulation:', typeof d3.voronoiMapSimulation); }

    //=============================================================================
    // d3-voronoi-treemap (inline)
    //=============================================================================
    (function(exports, d3VoronoiMap) {
        'use strict';

        function voronoiTreemap() {
            var DEFAULT_CONVERGENCE_RATIO = 0.01;
            var DEFAULT_MAX_ITERATION_COUNT = 50;
            var DEFAULT_MIN_WEIGHT_RATIO = 0.01;
            var DEFAULT_PRNG = Math.random;

            var clip = [[0, 0], [0, 1], [1, 1], [1, 0]];
            var extent = [[0, 0], [1, 1]];
            var size = [1, 1];
            var convergenceRatio = DEFAULT_CONVERGENCE_RATIO;
            var maxIterationCount = DEFAULT_MAX_ITERATION_COUNT;
            var minWeightRatio = DEFAULT_MIN_WEIGHT_RATIO;
            var prng = DEFAULT_PRNG;

            var unrelevantButNeedeData = [{ weight: 1 }, { weight: 1 }];
            var _convenientReusableVoronoiMapSimulation = d3VoronoiMap.voronoiMapSimulation(unrelevantButNeedeData).stop();

            function _voronoiTreemap(rootNode) {
                recurse(clip, rootNode);
            }

            _voronoiTreemap.convergenceRatio = function(_) {
                if (!arguments.length) return convergenceRatio;
                convergenceRatio = _;
                return _voronoiTreemap;
            };

            _voronoiTreemap.maxIterationCount = function(_) {
                if (!arguments.length) return maxIterationCount;
                maxIterationCount = _;
                return _voronoiTreemap;
            };

            _voronoiTreemap.minWeightRatio = function(_) {
                if (!arguments.length) return minWeightRatio;
                minWeightRatio = _;
                return _voronoiTreemap;
            };

            _voronoiTreemap.clip = function(_) {
                if (!arguments.length) return clip;
                _convenientReusableVoronoiMapSimulation.clip(_);
                clip = _convenientReusableVoronoiMapSimulation.clip();
                extent = _convenientReusableVoronoiMapSimulation.extent();
                size = _convenientReusableVoronoiMapSimulation.size();
                return _voronoiTreemap;
            };

            _voronoiTreemap.extent = function(_) {
                if (!arguments.length) return extent;
                _convenientReusableVoronoiMapSimulation.extent(_);
                clip = _convenientReusableVoronoiMapSimulation.clip();
                extent = _convenientReusableVoronoiMapSimulation.extent();
                size = _convenientReusableVoronoiMapSimulation.size();
                return _voronoiTreemap;
            };

            _voronoiTreemap.size = function(_) {
                if (!arguments.length) return size;
                _convenientReusableVoronoiMapSimulation.size(_);
                clip = _convenientReusableVoronoiMapSimulation.clip();
                extent = _convenientReusableVoronoiMapSimulation.extent();
                size = _convenientReusableVoronoiMapSimulation.size();
                return _voronoiTreemap;
            };

            _voronoiTreemap.prng = function(_) {
                if (!arguments.length) return prng;
                prng = _;
                return _voronoiTreemap;
            };

            function recurse(clippingPolygon, node) {
                var simulation;
                node.polygon = clippingPolygon;

                if (node.height != 0) {
                    simulation = d3VoronoiMap.voronoiMapSimulation(node.children)
                        .clip(clippingPolygon)
                        .weight(function(d) { return d.value; })
                        .convergenceRatio(convergenceRatio)
                        .maxIterationCount(maxIterationCount)
                        .minWeightRatio(minWeightRatio)
                        .prng(prng)
                        .stop();

                    var state = simulation.state();
                    while (!state.ended) {
                        simulation.tick();
                        state = simulation.state();
                    }

                    state.polygons.forEach(function(cp) {
                        recurse(cp, cp.site.originalObject.data.originalData);
                    });
                }
            }

            return _voronoiTreemap;
        }

        exports.voronoiTreemap = voronoiTreemap;
    })(d3, d3);

    if (window.VORONOI_DEBUG) { console.log('[d3-voronoi-bundle] d3.voronoiTreemap:', typeof d3.voronoiTreemap); }
    if (window.VORONOI_DEBUG) { console.log('[d3-voronoi-bundle] v23 - All libraries loaded successfully'); }

    return d3;
});

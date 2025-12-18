class cgIShape {
    constructor () {
        this.points = [];
        this.bary = [];
        this.indices = [];
    }
    
    addTriangle (x0,y0,z0,x1,y1,z1,x2,y2,z2) {
        var nverts = this.points.length / 4;
        
        // push first vertex
        this.points.push(x0);  this.bary.push (1.0);
        this.points.push(y0);  this.bary.push (0.0);
        this.points.push(z0);  this.bary.push (0.0);
        this.points.push(1.0);
        this.indices.push(nverts);
        nverts++;
        
        // push second vertex
        this.points.push(x1); this.bary.push (0.0);
        this.points.push(y1); this.bary.push (1.0);
        this.points.push(z1); this.bary.push (0.0);
        this.points.push(1.0);
        this.indices.push(nverts);
        nverts++
        
        // push third vertex
        this.points.push(x2); this.bary.push (0.0);
        this.points.push(y2); this.bary.push (0.0);
        this.points.push(z2); this.bary.push (1.0);
        this.points.push(1.0);
        this.indices.push(nverts);
        nverts++;
    }
}

class Cube extends cgIShape {
    
    constructor (subdivisions) {
        super();
        this.makeCube (subdivisions);
    }
    
    makeCube (subdivisions)  {
        
        // fill in your cube code here.
        const step = 1.0 / subdivisions;
        const s = 0.5;
        
        // Utility to add 2 triangles for a quad
        const addTriangle = this.addTriangle.bind(this);
        const quad = (a, b, c, d) => {
            addTriangle(...a, ...b, ...c);
            addTriangle(...a, ...c, ...d);
        };

        // Loop to build each face with correct orientation
        for (let i = 0; i < subdivisions; i++) {
            for (let j = 0; j < subdivisions; j++) {
                const x0 = -s + i * step;
                const x1 = x0 + step;
                const y0 = -s + j * step;
                const y1 = y0 + step;

                // FRONT (+Z)
                quad([x0, y0, s], [x1, y0, s], [x1, y1, s], [x0, y1, s]);
                // BACK (-Z)
                quad([x1, y0, -s], [x0, y0, -s], [x0, y1, -s], [x1, y1, -s]);
                // RIGHT (+X)
                quad([s, y0, x1], [s, y0, x0], [s, y1, x0], [s, y1, x1]);
                // LEFT (-X)
                quad([-s, y0, x0], [-s, y0, x1], [-s, y1, x1], [-s, y1, x0]);
                // TOP (+Y)
                quad([x0, s, y1], [x1, s, y1], [x1, s, y0], [x0, s, y0]);
                // BOTTOM (-Y)
                quad([x0, -s, y0], [x1, -s, y0], [x1, -s, y1], [x0, -s, y1]);
            }
        }
    }
}


class Cylinder extends cgIShape {

    constructor (radialdivision,heightdivision) {
        super();
        this.makeCylinder (radialdivision,heightdivision);
    }
    
    makeCylinder (radialdivision,heightdivision){
        // fill in your cylinder code here
        const radius = 0.5;
        const yTop = 0.5;
        const yBottom = -0.5;

        // Prevent degenerate shapes
        radialdivision = Math.max(3, Math.floor(radialdivision));
        heightdivision = Math.max(1, Math.floor(heightdivision));

        const dTheta = (2 * Math.PI) / radialdivision;
        const dy = (yTop - yBottom) / heightdivision;

        // --- Side faces ---
        for (let i = 0; i < radialdivision; i++) {
            const theta0 = i * dTheta;
            const theta1 = (i + 1) * dTheta;

            const x0 = radius * Math.cos(theta0);
            const z0 = radius * Math.sin(theta0);
            const x1 = radius * Math.cos(theta1);
            const z1 = radius * Math.sin(theta1);

            for (let j = 0; j < heightdivision; j++) {
                const y0 = yBottom + j * dy;
                const y1 = yBottom + (j + 1) * dy;

                // two triangles per rectangular patch
                this.addTriangle(x0, y1, z0, x1, y1, z1, x1, y0, z1);
                this.addTriangle(x0, y1, z0, x1, y0, z1, x0, y0, z0);
            }
        }

        // --- Top face ---
        for (let i = 0; i < radialdivision; i++) {
            const theta0 = i * dTheta;
            const theta1 = (i + 1) * dTheta;

            const x0 = radius * Math.cos(theta0);
            const z0 = radius * Math.sin(theta0);
            const x1 = radius * Math.cos(theta1);
            const z1 = radius * Math.sin(theta1);

            this.addTriangle(0, yTop, 0, x1, yTop, z1, x0, yTop, z0);
        }

        // --- Bottom face ---
        for (let i = 0; i < radialdivision; i++) {
            const theta0 = i * dTheta;
            const theta1 = (i + 1) * dTheta;

            const x0 = radius * Math.cos(theta0);
            const z0 = radius * Math.sin(theta0);
            const x1 = radius * Math.cos(theta1);
            const z1 = radius * Math.sin(theta1);

            this.addTriangle(0, yBottom, 0, x0, yBottom, z0, x1, yBottom, z1);
        }
    }
}

class Cone extends cgIShape {

    constructor (radialdivision, heightdivision) {
        super();
        this.makeCone (radialdivision, heightdivision);
    }
    
    
    makeCone (radialdivision, heightdivision) {
    
        // Fill in your cone code here.
        const radius = 0.5;
        const yBottom = -0.5;
        const yTop = 0.5; // tip of the cone

        // Prevent degenerate divisions
        radialdivision = Math.max(3, Math.floor(radialdivision));
        heightdivision = Math.max(1, Math.floor(heightdivision));

        const dTheta = (2 * Math.PI) / radialdivision;
        const dy = (yTop - yBottom) / heightdivision;

        // --- Side faces ---
        for (let i = 0; i < radialdivision; i++) {
            const theta0 = i * dTheta;
            const theta1 = (i + 1) * dTheta;

            for (let j = 0; j < heightdivision; j++) {
                const y0 = yBottom + j * dy;
                const y1 = yBottom + (j + 1) * dy;

                // linear radius taper
                const r0 = radius * (1 - (y0 - yBottom) / (yTop - yBottom));
                const r1 = radius * (1 - (y1 - yBottom) / (yTop - yBottom));

                const x00 = r0 * Math.cos(theta0);
                const z00 = r0 * Math.sin(theta0);
                const x01 = r0 * Math.cos(theta1);
                const z01 = r0 * Math.sin(theta1);

                const x10 = r1 * Math.cos(theta0);
                const z10 = r1 * Math.sin(theta0);
                const x11 = r1 * Math.cos(theta1);
                const z11 = r1 * Math.sin(theta1);

                // two triangles per vertical segment
                this.addTriangle(x00, y0, z00, x10, y1, z10, x11, y1, z11);
                this.addTriangle(x00, y0, z00, x11, y1, z11, x01, y0, z01);
            }
        }

        // --- Bottom face ---
        for (let i = 0; i < radialdivision; i++) {
            const theta0 = i * dTheta;
            const theta1 = (i + 1) * dTheta;

            const x0 = radius * Math.cos(theta0);
            const z0 = radius * Math.sin(theta0);
            const x1 = radius * Math.cos(theta1);
            const z1 = radius * Math.sin(theta1);

            this.addTriangle(0, yBottom, 0, x0, yBottom, z0, x1, yBottom, z1);
        }
    }
}
    
class Sphere extends cgIShape {

    constructor (slices, stacks) {
        super();
        this.makeSphere (slices, stacks);
    }
    
    makeSphere (slices, stacks) {
        // fill in your sphere code here
        const radius = 0.5;

        // Ensure we have at least a decagon and reasonable stacks for a spherical appearance.
        slices = Math.max(10, Math.floor(slices));
        stacks = Math.max(10, Math.floor(stacks));

        // Loop over stacks (latitude bands)
        for (let i = 0; i < stacks; i++) {
            // phi: 0 (north pole) -> PI (south pole)
            const phi0 = Math.PI * i / stacks;
            const phi1 = Math.PI * (i + 1) / stacks;

            // y positions for the two latitudes
            const y0 = radius * Math.cos(phi0);
            const y1 = radius * Math.cos(phi1);

            // radii of the rings at those latitudes
            const r0 = radius * Math.sin(phi0);
            const r1 = radius * Math.sin(phi1);

            for (let j = 0; j < slices; j++) {
                // theta: 0 -> 2PI around the sphere
                const theta0 = 2.0 * Math.PI * j / slices;
                const theta1 = 2.0 * Math.PI * (j + 1) / slices;

                // vertices on lower ring (phi0)
                const x00 = r0 * Math.cos(theta0);
                const z00 = r0 * Math.sin(theta0);
                const x01 = r0 * Math.cos(theta1);
                const z01 = r0 * Math.sin(theta1);

                // vertices on upper ring (phi1)
                const x10 = r1 * Math.cos(theta0);
                const z10 = r1 * Math.sin(theta0);
                const x11 = r1 * Math.cos(theta1);
                const z11 = r1 * Math.sin(theta1);

                // Special case: top cap (phi0 == 0 -> r0 == 0). Connect the top pole to the first ring.
                if (i === 0) {
                    // top pole at (0, +radius, 0)
                    // triangle: ring vertex at phi1 (theta0), ring vertex at phi1 (theta1), top
                    this.addTriangle(x10, y1, z10, x11, y1, z11, 0.0, radius, 0.0);
                }
                // Special case: bottom cap (phi1 == PI -> r1 == 0). Connect bottom pole to the last ring.
                else if (i === stacks - 1) {
                    // bottom pole at (0, -radius, 0)
                    // triangle: ring vertex at phi0 (theta0), bottom, ring vertex at phi0 (theta1)
                    this.addTriangle(x00, y0, z00, 0.0, -radius, 0.0, x01, y0, z01);
                }
                // Middle band: make two triangles per quad
                else {
                    // Triangle A: lower-left, upper-left, upper-right
                    this.addTriangle(x00, y0, z00, x10, y1, z10, x11, y1, z11);
                    // Triangle B: lower-left, upper-right, lower-right
                    this.addTriangle(x00, y0, z00, x11, y1, z11, x01, y0, z01);
                }
            }
        }
    }
    
}


function radians(degrees)
{
  var pi = Math.PI;
  return degrees * (pi/180);
}
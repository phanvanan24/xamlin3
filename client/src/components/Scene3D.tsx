import React, { useRef, useEffect, useState, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Text } from "@react-three/drei";
import * as THREE from "three";
import { useGeometry } from "../lib/stores/useGeometry";

function VertexLabel({ position, label, scale }: { position: [number, number, number]; label: string; scale: number }) {
  const sphereSize = 0.15 * scale;
  const fontSize = 0.5 * scale;
  const offset = 0.4 * scale;
  
  return (
    <>
      {/* Sphere at vertex for visibility */}
      <mesh position={position}>
        <sphereGeometry args={[sphereSize, 16, 16]} />
        <meshBasicMaterial color="red" />
      </mesh>
      
      {/* Text label */}
      <Text
        position={[position[0], position[1] + offset, position[2]]}
        fontSize={fontSize}
        color="black"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05 * scale}
        outlineColor="white"
      >
        {label}
      </Text>
    </>
  );
}

function ClickableEdge({ 
  start, 
  end, 
  edgeId,
  isSelected,
  onSelect,
  isHovered,
  onHover
}: { 
  start: [number, number, number]; 
  end: [number, number, number]; 
  edgeId: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const direction = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  const length = direction.length();
  const midpoint: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );

  const color = isSelected ? '#4ade80' : isHovered ? '#60a5fa' : '#000000';
  const thickness = isSelected || isHovered ? 0.08 : 0.05;

  return (
    <mesh
      position={midpoint}
      quaternion={quaternion}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(edgeId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(edgeId);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = 'default';
      }}
    >
      <cylinderGeometry args={[thickness, thickness, length, 8]} />
      <meshBasicMaterial color={color} transparent opacity={isSelected || isHovered ? 0.8 : 0.4} />
    </mesh>
  );
}

function ClickableFace({
  vertices,
  faceId,
  isSelected,
  onSelect,
  isHovered,
  onHover
}: {
  vertices: Array<[number, number, number]>;
  faceId: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const geometry = new THREE.BufferGeometry();
  
  const positions: number[] = [];
  for (let i = 1; i < vertices.length - 1; i++) {
    positions.push(...vertices[0], ...vertices[i], ...vertices[i + 1]);
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  const color = isSelected ? '#4ade80' : isHovered ? '#60a5fa' : '#3b82f6';

  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(faceId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(faceId);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = 'default';
      }}
    >
      <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.5 : isHovered ? 0.3 : 0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function Scene3D() {
  const { geometry, labelScale, distanceMode, editMode, selectedElements, addSelectedElement } = useGeometry();
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useThree();
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  useEffect(() => {
    // Clear previous geometry
    if (groupRef.current) {
      groupRef.current.clear();
    }

    if (geometry) {
      try {
        // Don't render the mesh itself, only draw edges
        // This gives us a clean wireframe without the gray transparent shape
        
        // Use threeJsCode directly
        let code = geometry.threeJsCode;
        
        // Create geometry to get its structure
        const geometryMesh = eval(code) as THREE.Mesh;
        
        if (geometryMesh && groupRef.current) {
          // Recalculate vertices based on parameters if needed
          let updatedGeometry = recalculateVertices(geometry);
          
          // Draw custom edges with dashed lines for hidden edges
          if (updatedGeometry.vertices && updatedGeometry.vertices.length > 0) {
            drawCustomEdges(groupRef.current, updatedGeometry);
          } else {
            // Fallback: Add standard edges only (no mesh)
            const edges = new THREE.EdgesGeometry(geometryMesh.geometry as THREE.BufferGeometry);
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
            const wireframe = new THREE.LineSegments(edges, lineMaterial);
            groupRef.current.add(wireframe);
          }
        }
      } catch (error) {
        console.error("Error creating 3D geometry:", error);
      }
    }
  }, [geometry]);

  // Recalculate vertices based on current parameter values
  function recalculateVertices(geomData: typeof geometry) {
    if (!geomData?.vertices) {
      return geomData!;
    }
    
    // Simply return the original vertices without any adjustments
    // since we removed parameter/edge/angle sliders
    return geomData;
  }

  // Helper function to draw edges with dashed lines for hidden edges
  function drawCustomEdges(group: THREE.Group, geomData: typeof geometry) {
    if (!geomData?.vertices) return;

    const vertexMap = new Map<string, [number, number, number]>();
    geomData.vertices.forEach((v: any) => vertexMap.set(v.label, v.position));

    const hiddenSet = new Set(
      geomData.hiddenEdges?.map(([a, b]: [string, string]) => `${a}-${b}|${b}-${a}`) || []
    );

    const auxiliarySet = new Set(
      geomData.auxiliaryLines?.map(([a, b]: [string, string]) => `${a}-${b}|${b}-${a}`) || []
    );

    const isHidden = (v1: string, v2: string) => 
      hiddenSet.has(`${v1}-${v2}`) || hiddenSet.has(`${v2}-${v1}`);
    
    const isAuxiliary = (v1: string, v2: string) => 
      auxiliarySet.has(`${v1}-${v2}`) || auxiliarySet.has(`${v2}-${v1}`);

    // Define edges based on geometry type
    const edges: [string, string][] = [];
    const labels = geomData.vertices.map((v: any) => v.label);

    // Detect geometry type and create edges
    if (labels.includes("A'") || labels.includes("B'")) {
      // Prism or box: connect bottom face, top face, and vertical edges
      const bottomVertices = labels.filter((l: string) => !l.includes("'"));
      const topVertices = labels.filter((l: string) => l.includes("'"));
      
      // Bottom face
      for (let i = 0; i < bottomVertices.length; i++) {
        edges.push([bottomVertices[i], bottomVertices[(i + 1) % bottomVertices.length]]);
      }
      
      // Top face
      for (let i = 0; i < topVertices.length; i++) {
        edges.push([topVertices[i], topVertices[(i + 1) % topVertices.length]]);
      }
      
      // Vertical edges
      bottomVertices.forEach((v: string) => {
        const topV = v + "'";
        if (topVertices.includes(topV)) {
          edges.push([v, topV]);
        }
      });
    } else if (labels.includes("S")) {
      // Pyramid: connect S to all base vertices, and base vertices to each other
      const baseVertices = labels.filter((l: string) => l !== "S" && !l.includes("H") && !l.includes("M") && !l.includes("O") && !l.includes("I"));
      baseVertices.forEach((v: string) => {
        // Don't add auxiliary lines to main edges
        if (!isAuxiliary("S", v)) {
          edges.push(["S", v]);
        }
      });
      for (let i = 0; i < baseVertices.length; i++) {
        const v1 = baseVertices[i];
        const v2 = baseVertices[(i + 1) % baseVertices.length];
        if (!isAuxiliary(v1, v2)) {
          edges.push([v1, v2]);
        }
      }
    }

    // Draw main edges
    edges.forEach(([v1, v2]) => {
      const pos1 = vertexMap.get(v1);
      const pos2 = vertexMap.get(v2);
      if (!pos1 || !pos2) return;

      const points = [new THREE.Vector3(...pos1), new THREE.Vector3(...pos2)];
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

      const lineMaterial = isHidden(v1, v2)
        ? new THREE.LineDashedMaterial({ color: 0x666666, dashSize: 0.2, gapSize: 0.1, linewidth: 1 })
        : new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

      const line = new THREE.Line(lineGeometry, lineMaterial);
      if (lineMaterial instanceof THREE.LineDashedMaterial) {
        line.computeLineDistances();
      }
      group.add(line);
    });

    // Draw auxiliary lines (đường cao, trung tuyến, etc.) - blue dashed
    if (geomData.auxiliaryLines) {
      geomData.auxiliaryLines.forEach(([v1, v2]: [string, string]) => {
        const pos1 = vertexMap.get(v1);
        const pos2 = vertexMap.get(v2);
        if (!pos1 || !pos2) return;

        const points = [new THREE.Vector3(...pos1), new THREE.Vector3(...pos2)];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

        // Blue dashed line for auxiliary lines
        const lineMaterial = new THREE.LineDashedMaterial({ 
          color: 0x3b82f6, // blue color
          dashSize: 0.15, 
          gapSize: 0.1, 
          linewidth: 2 
        });

        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.computeLineDistances();
        group.add(line);
      });
    }
  }


  // Extract edges from geometry
  const geometryEdges = useMemo(() => {
    if (!geometry?.vertices) return [];
    const vertexMap = new Map<string, [number, number, number]>();
    const updatedGeom = recalculateVertices(geometry);
    updatedGeom.vertices?.forEach((v: any) => vertexMap.set(v.label, v.position));
    
    const edges: Array<{ id: string; start: [number, number, number]; end: [number, number, number] }> = [];
    const labels = updatedGeom.vertices?.map((v: any) => v.label) || [];

    if (labels.includes("A'") || labels.includes("B'")) {
      const bottomVertices = labels.filter((l: string) => !l.includes("'") && !["M", "N", "H", "I", "O", "G"].includes(l));
      const topVertices = labels.filter((l: string) => l.includes("'") && !["M'", "N'", "H'", "I'", "O'", "G'"].includes(l));
      
      for (let i = 0; i < bottomVertices.length; i++) {
        const v1 = bottomVertices[i];
        const v2 = bottomVertices[(i + 1) % bottomVertices.length];
        const p1 = vertexMap.get(v1);
        const p2 = vertexMap.get(v2);
        if (p1 && p2) edges.push({ id: `${v1}-${v2}`, start: p1, end: p2 });
      }
      
      for (let i = 0; i < topVertices.length; i++) {
        const v1 = topVertices[i];
        const v2 = topVertices[(i + 1) % topVertices.length];
        const p1 = vertexMap.get(v1);
        const p2 = vertexMap.get(v2);
        if (p1 && p2) edges.push({ id: `${v1}-${v2}`, start: p1, end: p2 });
      }
      
      for (let i = 0; i < Math.min(bottomVertices.length, topVertices.length); i++) {
        const v1 = bottomVertices[i];
        const v2 = topVertices[i];
        const p1 = vertexMap.get(v1);
        const p2 = vertexMap.get(v2);
        if (p1 && p2) edges.push({ id: `${v1}-${v2}`, start: p1, end: p2 });
      }
    } else if (labels.includes("S")) {
      const baseVertices = labels.filter((l: string) => l !== "S" && !["M", "N", "H", "I", "O", "G"].includes(l));
      
      for (let i = 0; i < baseVertices.length; i++) {
        const v1 = baseVertices[i];
        const v2 = baseVertices[(i + 1) % baseVertices.length];
        const p1 = vertexMap.get(v1);
        const p2 = vertexMap.get(v2);
        if (p1 && p2) edges.push({ id: `${v1}-${v2}`, start: p1, end: p2 });
      }
      
      baseVertices.forEach((v: string) => {
        const p1 = vertexMap.get("S");
        const p2 = vertexMap.get(v);
        if (p1 && p2) edges.push({ id: `S-${v}`, start: p1, end: p2 });
      });
    }
    
    return edges;
  }, [geometry]);

  // Extract faces from geometry
  const geometryFaces = useMemo(() => {
    if (!geometry?.vertices) return [];
    const vertexMap = new Map<string, [number, number, number]>();
    const updatedGeom = recalculateVertices(geometry);
    updatedGeom.vertices?.forEach((v: any) => vertexMap.set(v.label, v.position));
    
    const faces: Array<{ id: string; vertices: Array<[number, number, number]> }> = [];
    const labels = updatedGeom.vertices?.map((v: any) => v.label) || [];

    if (labels.includes("A'") || labels.includes("B'")) {
      const bottomVertices = labels.filter((l: string) => !l.includes("'") && !["M", "N", "H", "I", "O", "G"].includes(l));
      const topVertices = labels.filter((l: string) => l.includes("'") && !["M'", "N'", "H'", "I'", "O'", "G'"].includes(l));
      
      const bottomPositions = bottomVertices.map((l: string) => vertexMap.get(l)).filter(Boolean) as Array<[number, number, number]>;
      if (bottomPositions.length > 0) {
        faces.push({ id: `base-${bottomVertices.join('')}`, vertices: bottomPositions });
      }
      
      const topPositions = topVertices.map((l: string) => vertexMap.get(l)).filter(Boolean) as Array<[number, number, number]>;
      if (topPositions.length > 0) {
        faces.push({ id: `top-${topVertices.join('')}`, vertices: topPositions });
      }
      
      for (let i = 0; i < Math.min(bottomVertices.length, topVertices.length); i++) {
        const b1 = bottomVertices[i];
        const b2 = bottomVertices[(i + 1) % bottomVertices.length];
        const t1 = topVertices[i];
        const t2 = topVertices[(i + 1) % topVertices.length];
        const positions = [b1, b2, t2, t1].map(l => vertexMap.get(l)).filter(Boolean) as Array<[number, number, number]>;
        if (positions.length === 4) {
          faces.push({ id: `side-${b1}${b2}${t1}${t2}`, vertices: positions });
        }
      }
    } else if (labels.includes("S")) {
      const baseVertices = labels.filter((l: string) => l !== "S" && !["M", "N", "H", "I", "O", "G"].includes(l));
      
      const basePositions = baseVertices.map((l: string) => vertexMap.get(l)).filter(Boolean) as Array<[number, number, number]>;
      if (basePositions.length > 0) {
        faces.push({ id: `base-${baseVertices.join('')}`, vertices: basePositions });
      }
      
      const apexPos = vertexMap.get("S");
      if (apexPos) {
        for (let i = 0; i < baseVertices.length; i++) {
          const v1 = baseVertices[i];
          const v2 = baseVertices[(i + 1) % baseVertices.length];
          const p1 = vertexMap.get(v1);
          const p2 = vertexMap.get(v2);
          if (p1 && p2) {
            faces.push({ id: `face-S${v1}${v2}`, vertices: [apexPos, p1, p2] });
          }
        }
      }
    }
    
    return faces;
  }, [geometry]);

  const handleElementSelect = (elementId: string) => {
    if (!distanceMode && !editMode) return;
    console.log('Selected element:', elementId);
    addSelectedElement(elementId);
  };

  return (
    <>
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        dampingFactor={0.05}
        enableDamping
      />
      
      <Grid
        args={[20, 20]}
        position={[0, -2, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6b7280"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#374151"
        fadeDistance={25}
        fadeStrength={1}
      />

      <group ref={groupRef} />

      {/* Render clickable edges when selecting lines (distance or edit modes) */}
      {( (distanceMode && (distanceMode === 'line-line' || distanceMode === 'line-plane')) || editMode ) && geometryEdges.map((edge) => (
        <ClickableEdge
          key={edge.id}
          start={edge.start}
          end={edge.end}
          edgeId={edge.id}
          isSelected={selectedElements.includes(edge.id)}
          onSelect={handleElementSelect}
          isHovered={hoveredElement === edge.id}
          onHover={setHoveredElement}
        />
      ))}

      {/* Render clickable faces when in plane selection mode */}
      {distanceMode && (distanceMode === 'plane-plane' || distanceMode === 'line-plane') && geometryFaces.map((face) => (
        <ClickableFace
          key={face.id}
          vertices={face.vertices}
          faceId={face.id}
          isSelected={selectedElements.includes(face.id)}
          onSelect={handleElementSelect}
          isHovered={hoveredElement === face.id}
          onHover={setHoveredElement}
        />
      ))}

      {/* Render vertex labels - recalculated based on parameters */}
      {(() => {
        const updatedGeom = recalculateVertices(geometry);
        return updatedGeom?.vertices?.map((vertex: any, index: number) => (
          <VertexLabel
            key={`${vertex.label}-${index}`}
            position={vertex.position}
            label={vertex.label}
            scale={labelScale}
          />
        ));
      })()}
    </>
  );
}

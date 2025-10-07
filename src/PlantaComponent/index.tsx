import React, { JSX, useMemo, useState } from 'react';
import './PlantaComponent.scss';

// PlantaInterativa.tsx
// Componente React + TypeScript que gera uma planta 2D em SVG a partir de N paredes.
// Entrada: comprimento (m) e ângulo (graus, direção absoluta, 0 = para a direita, 90 = para baixo)
// Funcionalidades: adicionar/remover paredes, modo ortogonal (90°), escala, exportar SVG, fechamento automático.

type Wall = {
  id: string;
  length: number; // metros
  angle: number; // graus, 0 = right, 90 = down
};

type LaminateConfig = {
  boardLength: number; // comprimento da tábua em metros
  boardWidth: number; // largura da tábua em metros
  expansionGap: number; // distância de expansão em metros
  minCutLength?: number; // comprimento mínimo de corte em metros
  maxCutLength?: number; // comprimento máximo de corte em metros
  rowJointOffset: number; // deslocamento das juntas em metros
  installationDirection: 'horizontal' | 'vertical'; // direção de instalação
};

type LaminatePiece = {
  id: string;
  length: number;
  width: number;
  x: number;
  y: number;
  isCut: boolean;
  originalLength?: number;
};

export default function PlantaInterativa(): JSX.Element {
  const [walls, setWalls] = useState<Wall[]>([
    { id: 'w1', length: 3.77, angle: 0 },
    { id: 'w2', length: 3.79, angle: 90 },
    { id: 'w3', length: 2.77, angle: 180 },
    { id: 'w4', length: 1.0, angle: 270 },
    { id: 'w5', length: 1, angle: 180 },
    { id: 'w6', length: 2.79, angle: 270 },
  ]);

  const [scaleMetersToPx, setScaleMetersToPx] = useState<number>(120); // pixels per meter
  const [orthogonal, setOrthogonal] = useState<boolean>(true);
  const [autoClose, setAutoClose] = useState<boolean>(false);
  
  // Laminate flooring configuration
  const [laminateConfig, setLaminateConfig] = useState<LaminateConfig>({
    boardLength: 1.2, // 120cm
    boardWidth: 0.2, // 20cm
    expansionGap: 0.01, // 1cm
    minCutLength: 0.3, // 30cm
    maxCutLength: 1.1, // 110cm
    rowJointOffset: 0.4, // 40cm
    installationDirection: 'horizontal'
  });
  
  const [showLaminateSection, setShowLaminateSection] = useState<boolean>(false);

  const updateWall = (id: string, patch: Partial<Wall>) => {
    setWalls(prev => prev.map(w => (w.id === id ? { ...w, ...patch } : w)));
  };

  const addWall = () => {
    const nextId = `w${Date.now()}`;
    const lastAngle = walls.length ? walls[walls.length - 1].angle : 0;
    setWalls(s => [...s, { id: nextId, length: 1, angle: lastAngle }]);
  };

  const removeWall = (id: string) => {
    setWalls(s => s.filter(w => w.id !== id));
  };

  // Calcula pontos (x,y) em metros
  const points = useMemo(() => {
    const pts: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
    let cx = 0,
      cy = 0;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const angleRad = (w.angle * Math.PI) / 180;
      const dx = Math.cos(angleRad) * w.length;
      const dy = Math.sin(angleRad) * w.length;
      cx += dx;
      cy += dy;
      pts.push({ x: cx, y: cy });
    }

    if (autoClose && pts.length > 1) {
      // Ajusta a última parede para fechar o polígono, alterando seu comprimento e mantendo o ângulo.
      const lastIndex = pts.length - 1;
      const target = pts[0];
      const prev = pts[lastIndex - 1];
      const vx = target.x - prev.x;
      const vy = target.y - prev.y;
      const newLen = Math.hypot(vx, vy);
      // recompute last point
      pts[lastIndex] = { x: target.x, y: target.y };
      // Also update underlying walls array length (but don't mutate state here directly)
    }

    return pts;
  }, [walls, autoClose]);

  // Compute bounding box to set SVG viewBox (in px)
  const bbox = useMemo(() => {
    if (!points.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    // padding in meters
    const pad = 0.5;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
    };
  }, [points]);

  // Helpers to convert meters -> px
  const m2px = (m: number) => m * scaleMetersToPx;

  // Build SVG path in pixels
  const svgPath = useMemo(() => {
    if (points.length === 0) return '';
    const path = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${m2px(p.x)} ${m2px(p.y)}`)
      .join(' ');
    return path;
  }, [points, scaleMetersToPx]);

  // Compute midpoints and labels for each wall
  const wallLabels = useMemo(() => {
    const labels: Array<{ x: number; y: number; text: string; angle: number }> =
      [];
    for (let i = 0; i < walls.length; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      labels.push({
        x: mx,
        y: my,
        text: `${walls[i].length.toFixed(2)} m,`,
        angle: ang,
      });
    }
    return labels;
  }, [walls, points]);

  const exportSVG = () => {
    // build a full svg string
    const width = m2px(bbox.maxX - bbox.minX);
    const height = m2px(bbox.maxY - bbox.minY);
    const viewBox = `${m2px(bbox.minX)} ${m2px(bbox.minY)} ${width} ${height}`;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}' width='${width}' height='${height}'>\n  <rect x='${m2px(
      bbox.minX
    )}' y='${m2px(
      bbox.minY
    )}' width='${width}' height='${height}' fill='white'/>\n  <path d='${svgPath}' stroke='black' stroke-width='${Math.max(
      1,
      scaleMetersToPx * 0.01
    )}' fill='none'/>\n</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planta.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper function to check if a point is inside the polygon
  const isPointInPolygon = (x: number, y: number, polygon: Array<{x: number, y: number}>) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > y) !== (polygon[j].y > y)) &&
          (x < (polygon[j].x - polygon[i].x) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  };

  // Helper function to check if a rectangle is inside the polygon
  const isRectangleInPolygon = (x: number, y: number, width: number, height: number, polygon: Array<{x: number, y: number}>) => {
    // Check all four corners of the rectangle
    const corners = [
      { x, y },
      { x: x + width, y },
      { x, y: y + height },
      { x: x + width, y: y + height }
    ];
    
    // All corners must be inside the polygon
    return corners.every(corner => isPointInPolygon(corner.x, corner.y, polygon));
  };

  // Calculate laminate flooring layout
  const laminateLayout = useMemo(() => {
    if (!showLaminateSection || points.length < 3) return [];
    
    // Create a polygon from the points with expansion gap
    const polygon = points.map(p => ({
      x: p.x,
      y: p.y
    }));
    
    // Calculate room dimensions for grid generation
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    
    // Apply expansion gap to create the actual flooring area
    const floorStartX = minX + laminateConfig.expansionGap;
    const floorEndX = maxX - laminateConfig.expansionGap;
    const floorStartY = minY + laminateConfig.expansionGap;
    const floorEndY = maxY - laminateConfig.expansionGap;
    
    const pieces: LaminatePiece[] = [];
    const { boardLength, boardWidth, rowJointOffset, installationDirection } = laminateConfig;
    
    if (installationDirection === 'horizontal') {
      // Boards run parallel to room width (along X axis)
      let row = 0;
      let y = floorStartY;
      
      while (y < floorEndY) {
        const isEvenRow = row % 2 === 0;
        const offset = isEvenRow ? 0 : rowJointOffset;
        
        // Always start from the left edge
        let currentX = floorStartX;
        let col = 0;
        
        // If this row has an offset, we need to place a piece to fill the gap
        if (!isEvenRow && offset > 0) {
          // Place a piece from the left edge with the offset length
          let offsetPieceLength = offset;
          let isCut = true;
          
          // Check if this offset piece fits in the polygon
          if (isRectangleInPolygon(currentX, y, offsetPieceLength, boardWidth, polygon)) {
            // Check cut length limits
            if (!laminateConfig.minCutLength || offsetPieceLength >= laminateConfig.minCutLength) {
              if (laminateConfig.maxCutLength && offsetPieceLength > laminateConfig.maxCutLength) {
                offsetPieceLength = laminateConfig.maxCutLength;
              }
              
              pieces.push({
                id: `piece-${row}-${col}`,
                length: offsetPieceLength,
                width: boardWidth,
                x: currentX,
                y,
                isCut: true,
                originalLength: boardLength
              });
              
              currentX += offsetPieceLength;
              col++;
            }
          }
        }
        
        // Continue placing pieces from current position
        while (currentX < floorEndX) {
          let pieceLength = boardLength;
          let isCut = false;
          
          // Check if piece extends beyond the floor boundary
          if (currentX + boardLength > floorEndX) {
            pieceLength = floorEndX - currentX;
            isCut = true;
          }
          
          // Check if the piece is inside the polygon
          if (!isRectangleInPolygon(currentX, y, pieceLength, boardWidth, polygon)) {
            // If piece is not inside, try to cut it to fit
            let testLength = pieceLength;
            while (testLength > 0.1 && !isRectangleInPolygon(currentX, y, testLength, boardWidth, polygon)) {
              testLength -= 0.1;
            }
            
            if (testLength <= 0.1) {
              // Skip this piece if it can't fit
              currentX += 0.1;
              continue;
            }
            
            pieceLength = testLength;
            isCut = true;
          }
          
          // Check cut length limits
          if (laminateConfig.minCutLength && pieceLength < laminateConfig.minCutLength) {
            currentX += 0.1;
            continue;
          }
          if (laminateConfig.maxCutLength && pieceLength > laminateConfig.maxCutLength) {
            pieceLength = laminateConfig.maxCutLength;
            isCut = true;
          }
          
          if (pieceLength > 0) {
            pieces.push({
              id: `piece-${row}-${col}`,
              length: pieceLength,
              width: boardWidth,
              x: currentX,
              y,
              isCut,
              originalLength: isCut ? boardLength : undefined
            });
          }
          
          currentX += pieceLength;
          col++;
        }
        
        y += boardWidth;
        row++;
      }
    } else {
      // Boards run parallel to room length (along Y axis)
      let row = 0;
      let x = floorStartX;
      
      while (x < floorEndX) {
        const isEvenRow = row % 2 === 0;
        const offset = isEvenRow ? 0 : rowJointOffset;
        
        // Always start from the top edge
        let currentY = floorStartY;
        let col = 0;
        
        // If this row has an offset, we need to place a piece to fill the gap
        if (!isEvenRow && offset > 0) {
          // Place a piece from the top edge with the offset length
          let offsetPieceLength = offset;
          let isCut = true;
          
          // Check if this offset piece fits in the polygon
          if (isRectangleInPolygon(x, currentY, boardWidth, offsetPieceLength, polygon)) {
            // Check cut length limits
            if (!laminateConfig.minCutLength || offsetPieceLength >= laminateConfig.minCutLength) {
              if (laminateConfig.maxCutLength && offsetPieceLength > laminateConfig.maxCutLength) {
                offsetPieceLength = laminateConfig.maxCutLength;
              }
              
              pieces.push({
                id: `piece-${row}-${col}`,
                length: offsetPieceLength,
                width: boardWidth,
                x,
                y: currentY,
                isCut: true,
                originalLength: boardLength
              });
              
              currentY += offsetPieceLength;
              col++;
            }
          }
        }
        
        // Continue placing pieces from current position
        while (currentY < floorEndY) {
          let pieceLength = boardLength;
          let isCut = false;
          
          // Check if piece extends beyond the floor boundary
          if (currentY + boardLength > floorEndY) {
            pieceLength = floorEndY - currentY;
            isCut = true;
          }
          
          // Check if the piece is inside the polygon
          if (!isRectangleInPolygon(x, currentY, boardWidth, pieceLength, polygon)) {
            // If piece is not inside, try to cut it to fit
            let testLength = pieceLength;
            while (testLength > 0.1 && !isRectangleInPolygon(x, currentY, boardWidth, testLength, polygon)) {
              testLength -= 0.1;
            }
            
            if (testLength <= 0.1) {
              // Skip this piece if it can't fit
              currentY += 0.1;
              continue;
            }
            
            pieceLength = testLength;
            isCut = true;
          }
          
          // Check cut length limits
          if (laminateConfig.minCutLength && pieceLength < laminateConfig.minCutLength) {
            currentY += 0.1;
            continue;
          }
          if (laminateConfig.maxCutLength && pieceLength > laminateConfig.maxCutLength) {
            pieceLength = laminateConfig.maxCutLength;
            isCut = true;
          }
          
          if (pieceLength > 0) {
            pieces.push({
              id: `piece-${row}-${col}`,
              length: pieceLength,
              width: boardWidth,
              x,
              y: currentY,
              isCut,
              originalLength: isCut ? boardLength : undefined
            });
          }
          
          currentY += pieceLength;
          col++;
        }
        
        x += boardWidth;
        row++;
      }
    }
    
    return pieces;
  }, [showLaminateSection, points, laminateConfig]);

  return (
    <div className='planta-container'>
      <header className='planta-header'>
        <h1>Planta Interativa</h1>
        <p className='subtitle'>Crie e visualize plantas 2D interativas com precisão</p>
      </header>

      <main className='planta-main'>
        <aside className='control-panel'>
          {/* Settings Card */}
          <div className='card'>
            <div className='card-header'>
              <h2>⚙️ Configurações</h2>
            </div>
            <div className='card-content'>
              <div className='settings-section'>
                <div className='setting-group'>
                  <label className='setting-label'>
                    <input
                      type='checkbox'
                      className='checkbox'
                      checked={orthogonal}
                      onChange={e => setOrthogonal(e.target.checked)}
                    />
                    <span>Modo ortogonal (90°)</span>
                  </label>
                </div>

                <div className='setting-group'>
                  <label className='setting-label'>
                    <input
                      type='checkbox'
                      className='checkbox'
                      checked={autoClose}
                      onChange={e => setAutoClose(e.target.checked)}
                    />
                    <span>Fechamento automático</span>
                  </label>
                </div>

                <div className='setting-group'>
                  <div className='slider-group'>
                    <div className='slider-label'>
                      <span>Escala</span>
                      <span>{scaleMetersToPx} px/m</span>
                    </div>
                    <input
                      type='range'
                      className='slider'
                      min={20}
                      max={300}
                      value={scaleMetersToPx}
                      onChange={e => setScaleMetersToPx(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className='action-buttons'>
                <button
                  className='btn btn-primary'
                  onClick={addWall}
                >
                  <span>+</span>
                  Adicionar Parede
                </button>
                <button
                  className='btn btn-secondary'
                  onClick={exportSVG}
                >
                  📁 Exportar SVG
                </button>
                <button
                  className={`btn ${showLaminateSection ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setShowLaminateSection(!showLaminateSection)}
                >
                  🏠 {showLaminateSection ? 'Ocultar' : 'Mostrar'} Piso Laminado
                </button>
              </div>
            </div>
          </div>

          {/* Walls List Card */}
          <div className='card'>
            <div className='card-header'>
              <h2>🧱 Paredes ({walls.length})</h2>
            </div>
            <div className='card-content'>
              <div className='walls-section'>
                <div className='walls-list'>
                  {walls.map((w, i) => (
                    <div key={w.id} className='wall-item'>
                      <div className='wall-number'>#{i + 1}</div>
                      <div className='wall-inputs'>
                        <div className='input-group'>
                          <label className='input-label'>Comprimento (m)</label>
                          <input
                            className='input input-length'
                            type='number'
                            step='0.01'
                            value={w.length}
                            onChange={e =>
                              updateWall(w.id, { length: Number(e.target.value) })
                            }
                            title='Comprimento da parede em metros'
                            placeholder='0.00'
                          />
                        </div>
                        <div className='input-group'>
                          <label className='input-label'>Ângulo (°)</label>
                          <input
                            className='input input-angle'
                            type='number'
                            step='1'
                            value={w.angle}
                            onChange={e => {
                              let val = Number(e.target.value);
                              if (orthogonal) {
                                val = Math.round(val / 90) * 90;
                              }
                              updateWall(w.id, { angle: val });
                            }}
                            title='Ângulo da parede em graus (0° = direita, 90° = baixo)'
                            placeholder='0'
                          />
                        </div>
                      </div>
                      <button
                        className='btn btn-danger btn-sm delete-btn'
                        onClick={() => removeWall(w.id)}
                        title='Remover parede'
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Laminate Configuration Card */}
          {showLaminateSection && (
            <div className='card'>
              <div className='card-header'>
                <h2>🏠 Configuração Piso Laminado</h2>
              </div>
              <div className='card-content'>
                <div className='settings-section'>
                  <div className='setting-group'>
                    <div className='slider-group'>
                      <div className='slider-label'>
                        <span>Comprimento da Tábua (m)</span>
                        <span>{laminateConfig.boardLength.toFixed(2)}</span>
                      </div>
                      <input
                        type='range'
                        className='slider'
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        value={laminateConfig.boardLength}
                        onChange={e => setLaminateConfig(prev => ({
                          ...prev,
                          boardLength: Number(e.target.value)
                        }))}
                      />
                    </div>
                  </div>

                  <div className='setting-group'>
                    <div className='slider-group'>
                      <div className='slider-label'>
                        <span>Largura da Tábua (m)</span>
                        <span>{laminateConfig.boardWidth.toFixed(2)}</span>
                      </div>
                      <input
                        type='range'
                        className='slider'
                        min={0.1}
                        max={0.5}
                        step={0.01}
                        value={laminateConfig.boardWidth}
                        onChange={e => setLaminateConfig(prev => ({
                          ...prev,
                          boardWidth: Number(e.target.value)
                        }))}
                      />
                    </div>
                  </div>

                  <div className='setting-group'>
                    <div className='slider-group'>
                      <div className='slider-label'>
                        <span>Distância de Expansão (m)</span>
                        <span>{laminateConfig.expansionGap.toFixed(3)}</span>
                      </div>
                      <input
                        type='range'
                        className='slider'
                        min={0.005}
                        max={0.05}
                        step={0.005}
                        value={laminateConfig.expansionGap}
                        onChange={e => setLaminateConfig(prev => ({
                          ...prev,
                          expansionGap: Number(e.target.value)
                        }))}
                      />
                    </div>
                  </div>

                  <div className='setting-group'>
                    <div className='slider-group'>
                      <div className='slider-label'>
                        <span>Deslocamento das Juntas (m)</span>
                        <span>{laminateConfig.rowJointOffset.toFixed(2)}</span>
                      </div>
                      <input
                        type='range'
                        className='slider'
                        min={0.1}
                        max={1.0}
                        step={0.1}
                        value={laminateConfig.rowJointOffset}
                        onChange={e => setLaminateConfig(prev => ({
                          ...prev,
                          rowJointOffset: Number(e.target.value)
                        }))}
                      />
                    </div>
                  </div>

                  <div className='setting-group'>
                    <label className='setting-label'>
                      <input
                        type='checkbox'
                        className='checkbox'
                        checked={!!laminateConfig.minCutLength}
                        onChange={e => setLaminateConfig(prev => ({
                          ...prev,
                          minCutLength: e.target.checked ? 0.3 : undefined
                        }))}
                      />
                      <span>Usar comprimento mínimo de corte</span>
                    </label>
                    {laminateConfig.minCutLength && (
                      <div className='slider-group'>
                        <div className='slider-label'>
                          <span>Comprimento mínimo (m)</span>
                          <span>{laminateConfig.minCutLength.toFixed(2)}</span>
                        </div>
                        <input
                          type='range'
                          className='slider'
                          min={0.1}
                          max={1.0}
                          step={0.1}
                          value={laminateConfig.minCutLength}
                          onChange={e => setLaminateConfig(prev => ({
                            ...prev,
                            minCutLength: Number(e.target.value)
                          }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className='setting-group'>
                    <label className='setting-label'>
                      <input
                        type='checkbox'
                        className='checkbox'
                        checked={!!laminateConfig.maxCutLength}
                        onChange={e => setLaminateConfig(prev => ({
                          ...prev,
                          maxCutLength: e.target.checked ? 1.1 : undefined
                        }))}
                      />
                      <span>Usar comprimento máximo de corte</span>
                    </label>
                    {laminateConfig.maxCutLength && (
                      <div className='slider-group'>
                        <div className='slider-label'>
                          <span>Comprimento máximo (m)</span>
                          <span>{laminateConfig.maxCutLength.toFixed(2)}</span>
                        </div>
                        <input
                          type='range'
                          className='slider'
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          value={laminateConfig.maxCutLength}
                          onChange={e => setLaminateConfig(prev => ({
                            ...prev,
                            maxCutLength: Number(e.target.value)
                          }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className='setting-group'>
                    <div className='slider-label'>
                      <span>Direção de Instalação</span>
                    </div>
                    <div className='radio-group'>
                      <label className='radio-label'>
                        <input
                          type='radio'
                          name='installationDirection'
                          value='horizontal'
                          checked={laminateConfig.installationDirection === 'horizontal'}
                          onChange={e => setLaminateConfig(prev => ({
                            ...prev,
                            installationDirection: e.target.value as 'horizontal' | 'vertical'
                          }))}
                        />
                        <span>Horizontal (paralelo à largura)</span>
                      </label>
                      <label className='radio-label'>
                        <input
                          type='radio'
                          name='installationDirection'
                          value='vertical'
                          checked={laminateConfig.installationDirection === 'vertical'}
                          onChange={e => setLaminateConfig(prev => ({
                            ...prev,
                            installationDirection: e.target.value as 'horizontal' | 'vertical'
                          }))}
                        />
                        <span>Vertical (paralelo ao comprimento)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className='laminate-stats'>
                  <h3>📊 Estatísticas do Layout</h3>
                  <div className='stats-grid'>
                    <div className='stat-item'>
                      <span className='stat-label'>Total de Peças:</span>
                      <span className='stat-value'>{laminateLayout.length}</span>
                    </div>
                    <div className='stat-item'>
                      <span className='stat-label'>Peças Cortadas:</span>
                      <span className='stat-value'>{laminateLayout.filter(p => p.isCut).length}</span>
                    </div>
                    <div className='stat-item'>
                      <span className='stat-label'>Área Total (m²):</span>
                      <span className='stat-value'>
                        {laminateLayout.reduce((sum, p) => sum + (p.length * p.width), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Visualization Section */}
        <section className='visualization-section'>
          <div className='card'>
            <div className='card-header'>
              <h2>📐 Visualização</h2>
            </div>
            <div className='card-content'>
              <div className='svg-container'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='100%'
                  height='600'
                  viewBox={`${m2px(bbox.minX)} ${m2px(bbox.minY)} ${m2px(
                    bbox.maxX - bbox.minX
                  )} ${m2px(bbox.maxY - bbox.minY)}`}
                >
                  {/* Grid Pattern */}
                  <defs>
                    <pattern
                      id='smallGrid'
                      width={m2px(0.5)}
                      height={m2px(0.5)}
                      patternUnits='userSpaceOnUse'
                    >
                      <path
                        d={`M ${m2px(bbox.minX)} ${m2px(bbox.minY)} h ${m2px(
                          0.5
                        )} v ${m2px(0.5)}`}
                        fill='none'
                        stroke='#e2e8f0'
                        strokeWidth={0.5}
                      />
                    </pattern>
                    <pattern
                      id='largeGrid'
                      width={m2px(2)}
                      height={m2px(2)}
                      patternUnits='userSpaceOnUse'
                    >
                      <rect
                        width={m2px(2)}
                        height={m2px(2)}
                        fill='url(#smallGrid)'
                      />
                      <path
                        d={`M ${m2px(bbox.minX)} ${m2px(bbox.minY)} h ${m2px(
                          2
                        )} v ${m2px(2)}`}
                        fill='none'
                        stroke='#cbd5e1'
                        strokeWidth={1}
                      />
                    </pattern>
                  </defs>

                  {/* Background Grid */}
                  <rect
                    x={m2px(bbox.minX)}
                    y={m2px(bbox.minY)}
                    width={m2px(bbox.maxX - bbox.minX)}
                    height={m2px(bbox.maxY - bbox.minY)}
                    fill='url(#largeGrid)'
                  />

                  {/* Floor Plan Path */}
                  <path
                    d={svgPath}
                    stroke='#1e293b'
                    strokeWidth={Math.max(2, scaleMetersToPx * 0.015)}
                    fill='rgba(59, 130, 246, 0.1)'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />

                  {/* Wall Segments */}
                  {points.slice(0, -1).map((p, i) => {
                    const q = points[i + 1];
                    if (!q) return null;
                    return (
                      <line
                        key={i}
                        x1={m2px(p.x)}
                        y1={m2px(p.y)}
                        x2={m2px(q.x)}
                        y2={m2px(q.y)}
                        stroke='#3b82f6'
                        strokeWidth={Math.max(3, scaleMetersToPx * 0.025)}
                        strokeLinecap='round'
                      />
                    );
                  })}

                  {/* Wall Labels */}
                  {wallLabels.map((lab, i) => (
                    <g
                      key={i}
                      transform={`translate(${m2px(lab.x)}, ${m2px(
                        lab.y
                      )}) rotate(${lab.angle})`}
                    >
                      <rect
                        x={-35}
                        y={-12}
                        width={70}
                        height={20}
                        rx={10}
                        fill='rgba(255, 255, 255, 0.95)'
                        stroke='#3b82f6'
                        strokeWidth={1}
                        filter='drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                      />
                      <text
                        x={0}
                        y={2}
                        fontSize={11}
                        textAnchor='middle'
                        alignmentBaseline='middle'
                        fill='#1e293b'
                        fontWeight='500'
                      >
                        {lab.text}
                      </text>
                    </g>
                  ))}

                  {/* Laminate Flooring Pieces */}
                  {showLaminateSection && laminateLayout.map((piece) => (
                    <g key={piece.id}>
                      <rect
                        x={m2px(piece.x)}
                        y={m2px(piece.y)}
                        width={m2px(piece.length)}
                        height={m2px(piece.width)}
                        fill={piece.isCut ? '#fbbf24' : '#10b981'}
                        stroke={piece.isCut ? '#f59e0b' : '#059669'}
                        strokeWidth={1}
                        opacity={0.7}
                      />
                      {piece.isCut && (
                        <text
                          x={m2px(piece.x + piece.length / 2)}
                          y={m2px(piece.y + piece.width / 2)}
                          fontSize={8}
                          textAnchor='middle'
                          alignmentBaseline='middle'
                          fill='#92400e'
                          fontWeight='500'
                        >
                          {piece.length.toFixed(2)}m
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Connection Points */}
                  {points.map((p, i) => (
                    <g key={`n${i}`}>
                      <circle
                        cx={m2px(p.x)}
                        cy={m2px(p.y)}
                        r={Math.max(4, scaleMetersToPx * 0.015)}
                        fill='#ef4444'
                        stroke='white'
                        strokeWidth={2}
                        filter='drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                      />
                      <text
                        x={m2px(p.x) + 8}
                        y={m2px(p.y) - 8}
                        fontSize={10}
                        fill='#64748b'
                        fontWeight='500'
                      >
                        {`(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className='info-text'>
                <strong>💡 Dicas:</strong> Use o modo ortogonal para criar plantas com cantos retos. 
                O fechamento automático ajusta a última parede para formar um polígono fechado. 
                Ajuste a escala para melhor visualização.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
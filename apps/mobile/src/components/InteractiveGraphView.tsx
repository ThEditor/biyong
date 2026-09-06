import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from "react-native";
import Svg, { Line, Rect, Text as SvgText, G, Polygon } from "react-native-svg";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeContext";
import { formatMoney, type DependencyGraphNode, type DependencyGraphEdge } from "@biyong/domain";

export interface InteractiveGraphViewProps {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
  currency?: string;
  activeFilter?: "all" | "pay" | "share" | "settle";
}

interface NodePosition {
  x: number;
  y: number;
}

const CANVAS_HEIGHT = 440;
const NODE_RADIUS = 28;
const EXPENSE_NODE_WIDTH = 92;
const EXPENSE_NODE_HEIGHT = 46;
const LANE_SPACING = 26; // Distance between parallel directional arrows

export const InteractiveGraphView: React.FC<InteractiveGraphViewProps> = ({
  nodes,
  edges,
  currency = "INR",
  activeFilter = "all",
}) => {
  const { colors, tokens } = useAppTheme();
  const screenWidth = Dimensions.get("window").width;
  const canvasWidth = Math.max(320, screenWidth - 32);

  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Interaction Mode: 'move' (default, dragging nodes has top priority) vs 'pan' (dragging anywhere pans canvas)
  const [interactionMode, setInteractionMode] = useState<"move" | "pan">("move");
  const isDraggingNodeRef = useRef<boolean>(false);

  // Zoom and Pan State
  const [scale, setScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Refs to allow high-frequency gesture updates without stale closures or re-rendering responders
  const positionsRef = useRef<Record<string, NodePosition>>({});
  positionsRef.current = positions;

  const dragOffsetsRef = useRef<Record<string, { startX: number; startY: number }>>({});
  const scaleRef = useRef<number>(1);
  scaleRef.current = scale;

  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  panOffsetRef.current = panOffset;

  const pinchDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const panStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Compute initial layout (circular / bipartite)
  const computeInitialLayout = () => {
    const newPositions: Record<string, NodePosition> = {};
    const memberNodes = nodes.filter((n) => n.type === "member");
    const nonMemberNodes = nodes.filter((n) => n.type !== "member");

    const centerX = canvasWidth / 2;
    const centerY = CANVAS_HEIGHT / 2;

    if (nodes.length <= 1) {
      if (nodes[0]) newPositions[nodes[0].id] = { x: centerX, y: centerY };
      return newPositions;
    }

    if (memberNodes.length > 0 && nonMemberNodes.length > 0) {
      // Members on top arc, expenses in middle/bottom
      const memberCount = memberNodes.length;
      const memberSpacing = Math.min(100, (canvasWidth - 60) / Math.max(1, memberCount));
      const memberStartX = centerX - ((memberCount - 1) * memberSpacing) / 2;

      memberNodes.forEach((node, idx) => {
        newPositions[node.id] = {
          x: Math.max(
            NODE_RADIUS + 12,
            Math.min(canvasWidth - NODE_RADIUS - 12, memberStartX + idx * memberSpacing)
          ),
          y: 75 + (idx % 2 === 0 ? 0 : 25),
        };
      });

      const nonMemberCount = nonMemberNodes.length;
      const nonMemberSpacing = Math.min(110, (canvasWidth - 80) / Math.max(1, nonMemberCount));
      const nonMemberStartX = centerX - ((nonMemberCount - 1) * nonMemberSpacing) / 2;

      nonMemberNodes.forEach((node, idx) => {
        newPositions[node.id] = {
          x: Math.max(60, Math.min(canvasWidth - 60, nonMemberStartX + idx * nonMemberSpacing)),
          y: CANVAS_HEIGHT - 100 - (idx % 2 === 0 ? 0 : 35),
        };
      });
    } else {
      // Circular distribution
      const count = nodes.length;
      const radius = Math.min(canvasWidth / 2 - 50, CANVAS_HEIGHT / 2 - 50);
      nodes.forEach((node, idx) => {
        const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
        newPositions[node.id] = {
          x: Math.round(centerX + radius * Math.cos(angle)),
          y: Math.round(centerY + radius * Math.sin(angle)),
        };
      });
    }

    return newPositions;
  };

  // Reset or initialize layout on nodes change
  useEffect(() => {
    const init = computeInitialLayout();
    setPositions(init);
    positionsRef.current = init;
    setSelectedNodeId(null);
  }, [nodes.map((n) => n.id).join(","), canvasWidth]);

  // Filtered edges
  const visibleEdges = useMemo(() => {
    return edges.filter((e) => {
      if (activeFilter === "pay") return e.label.toLowerCase().includes("paid");
      if (activeFilter === "share") return e.label.toLowerCase().includes("share");
      if (activeFilter === "settle") return e.label.toLowerCase().includes("settled");
      return true;
    });
  }, [edges, activeFilter]);

  // Group visible edges by unordered node pair to prevent overlapping arrows
  const edgesByPair = useMemo(() => {
    const map = new Map<string, DependencyGraphEdge[]>();
    for (const edge of visibleEdges) {
      const u = edge.source;
      const v = edge.target;
      const pairKey = u < v ? `${u}:::${v}` : `${v}:::${u}`;
      const list = map.get(pairKey) || [];
      list.push(edge);
      map.set(pairKey, list);
    }
    return map;
  }, [visibleEdges]);

  // Zoom & Pan Handlers
  const handleZoomIn = () => {
    setScale((s) => {
      const next = Math.min(2.5, Number((s + 0.25).toFixed(2)));
      scaleRef.current = next;
      return next;
    });
  };

  const handleZoomOut = () => {
    setScale((s) => {
      const next = Math.max(0.5, Number((s - 0.25).toFixed(2)));
      scaleRef.current = next;
      return next;
    });
  };

  const handleResetZoomPan = () => {
    setScale(1);
    scaleRef.current = 1;
    setPanOffset({ x: 0, y: 0 });
    panOffsetRef.current = { x: 0, y: 0 };
  };

  const handleAutoLayout = () => {
    const fresh = computeInitialLayout();
    setPositions(fresh);
    positionsRef.current = fresh;
    handleResetZoomPan();
    setSelectedNodeId(null);
  };

  // Canvas PanResponder for background panning and two-finger pinch-to-zoom
  const canvasPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (isDraggingNodeRef.current) return false;
        if (evt.nativeEvent.touches.length >= 2) return true;
        return interactionMode === "pan";
      },
      onStartShouldSetPanResponderCapture: (evt) => {
        if (isDraggingNodeRef.current) return false;
        if (evt.nativeEvent.touches.length >= 2) return true;
        return interactionMode === "pan";
      },
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (isDraggingNodeRef.current) return false;
        if (gesture.numberActiveTouches >= 2) return true;
        if (interactionMode === "pan") {
          return Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2;
        }
        return false;
      },
      onMoveShouldSetPanResponderCapture: (evt, gesture) => {
        if (isDraggingNodeRef.current) return false;
        if (evt.nativeEvent.touches.length >= 2 || gesture.numberActiveTouches >= 2) return true;
        return interactionMode === "pan";
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        panStartOffsetRef.current = { ...panOffsetRef.current };
        if (touches.length >= 2) {
          const t0 = touches[0]!;
          const t1 = touches[1]!;
          const dx = t1.pageX - t0.pageX;
          const dy = t1.pageY - t0.pageY;
          pinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
          pinchStartScaleRef.current = scaleRef.current;
        } else {
          pinchDistRef.current = null;
        }
      },
      onPanResponderMove: (evt, gesture) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          // Pinch to zoom
          const t0 = touches[0]!;
          const t1 = touches[1]!;
          const dx = t1.pageX - t0.pageX;
          const dy = t1.pageY - t0.pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (pinchDistRef.current === null) {
            pinchDistRef.current = dist;
            pinchStartScaleRef.current = scaleRef.current;
            panStartOffsetRef.current = { ...panOffsetRef.current };
          } else if (pinchDistRef.current > 10) {
            const factor = dist / pinchDistRef.current;
            const nextScale = Math.min(
              2.5,
              Math.max(0.5, Number((pinchStartScaleRef.current * factor).toFixed(3)))
            );
            setScale(nextScale);
            scaleRef.current = nextScale;
          }

          // Combined two-finger pan
          const maxPan = canvasWidth * 1.2;
          const nextPanX = Math.max(-maxPan, Math.min(maxPan, panStartOffsetRef.current.x + gesture.dx));
          const nextPanY = Math.max(-CANVAS_HEIGHT * 1.2, Math.min(CANVAS_HEIGHT * 1.2, panStartOffsetRef.current.y + gesture.dy));
          setPanOffset({ x: nextPanX, y: nextPanY });
          panOffsetRef.current = { x: nextPanX, y: nextPanY };
        } else if (touches.length === 1 && !pinchDistRef.current && interactionMode === "pan") {
          // Single-finger canvas background pan (in Pan mode)
          const maxPan = canvasWidth * 1.2;
          const nextPanX = Math.max(-maxPan, Math.min(maxPan, panStartOffsetRef.current.x + gesture.dx));
          const nextPanY = Math.max(-CANVAS_HEIGHT * 1.2, Math.min(CANVAS_HEIGHT * 1.2, panStartOffsetRef.current.y + gesture.dy));
          setPanOffset({ x: nextPanX, y: nextPanY });
          panOffsetRef.current = { x: nextPanX, y: nextPanY };
        }
      },
      onPanResponderRelease: (_, gesture) => {
        pinchDistRef.current = null;
        // Deselect if user just tapped empty canvas background
        if (Math.abs(gesture.dx) < 3 && Math.abs(gesture.dy) < 3) {
          setSelectedNodeId(null);
        }
      },
      onPanResponderTerminate: () => {
        pinchDistRef.current = null;
      },
    });
  }, [canvasWidth, interactionMode]);

  // Persistent PanResponders for each individual node
  const panResponders = useMemo(() => {
    const responders: Record<string, ReturnType<typeof PanResponder.create>> = {};

    nodes.forEach((node) => {
      responders[node.id] = PanResponder.create({
        onStartShouldSetPanResponder: () => interactionMode === "move",
        onStartShouldSetPanResponderCapture: () => interactionMode === "move",
        onMoveShouldSetPanResponder: () => interactionMode === "move",
        onMoveShouldSetPanResponderCapture: () => interactionMode === "move",
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          isDraggingNodeRef.current = true;
          setSelectedNodeId(node.id);
          const current = positionsRef.current[node.id] || {
            x: canvasWidth / 2,
            y: CANVAS_HEIGHT / 2,
          };
          dragOffsetsRef.current[node.id] = {
            startX: current.x,
            startY: current.y,
          };
        },
        onPanResponderMove: (_, gesture) => {
          const origin = dragOffsetsRef.current[node.id];
          if (!origin) return;

          // Scale gesture delta by current zoom scale for 1:1 finger tracking!
          const currentScale = scaleRef.current || 1;
          const scaledDx = gesture.dx / currentScale;
          const scaledDy = gesture.dy / currentScale;

          const margin = 140;
          const newX = Math.max(-margin, Math.min(canvasWidth + margin, origin.startX + scaledDx));
          const newY = Math.max(-margin, Math.min(CANVAS_HEIGHT + margin, origin.startY + scaledDy));

          setPositions((prev) => {
            const next = { ...prev, [node.id]: { x: newX, y: newY } };
            positionsRef.current = next;
            return next;
          });
        },
        onPanResponderRelease: () => {
          isDraggingNodeRef.current = false;
          delete dragOffsetsRef.current[node.id];
        },
        onPanResponderTerminate: () => {
          isDraggingNodeRef.current = false;
          delete dragOffsetsRef.current[node.id];
        },
      });
    });

    return responders;
  }, [nodes, canvasWidth, interactionMode]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <View style={styles.container}>
      {/* Visual Canvas Box */}
      <View
        style={[
          styles.canvasBox,
          {
            width: canvasWidth,
            height: CANVAS_HEIGHT,
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.border,
            borderRadius: tokens.radius.lg,
          },
        ]}
        {...canvasPanResponder.panHandlers}
      >
        {/* Transformable Canvas Layer (Zoom & Pan Container) */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateX: panOffset.x },
                { translateY: panOffset.y },
                { scale: scale },
              ],
            },
          ]}
        >
          {/* SVG Directional Connections Layer */}
          <Svg style={StyleSheet.absoluteFill} width={canvasWidth} height={CANVAS_HEIGHT}>
            {visibleEdges.map((edge) => {
              const pairKey =
                edge.source < edge.target
                  ? `${edge.source}:::${edge.target}`
                  : `${edge.target}:::${edge.source}`;
              const pairGroup = edgesByPair.get(pairKey) || [edge];
              const groupSize = pairGroup.length;
              const indexInGroup = pairGroup.indexOf(edge);

              const nodeA = edge.source < edge.target ? edge.source : edge.target;
              const nodeB = edge.source < edge.target ? edge.target : edge.source;
              const posA = positions[nodeA];
              const posB = positions[nodeB];
              const sourceCenter = positions[edge.source];
              const targetCenter = positions[edge.target];

              if (!posA || !posB || !sourceCenter || !targetCenter) return null;

              // Centerline distance & normal vector for this node pair
              const cdx = posB.x - posA.x;
              const cdy = posB.y - posA.y;
              const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
              if (cdist < 15) return null;

              const cux = cdx / cdist;
              const cuy = cdy / cdist;
              const normX = -cuy;
              const normY = cux;

              // Perpendicular offset for parallel lanes (prevents overlapping!)
              const offset =
                groupSize > 1 ? (indexInGroup - (groupSize - 1) / 2) * LANE_SPACING : 0;
              const shiftX = offset * normX;
              const shiftY = offset * normY;

              const shiftedSource = { x: sourceCenter.x + shiftX, y: sourceCenter.y + shiftY };
              const shiftedTarget = { x: targetCenter.x + shiftX, y: targetCenter.y + shiftY };

              // Vector along directed edge
              const edx = shiftedTarget.x - shiftedSource.x;
              const edy = shiftedTarget.y - shiftedSource.y;
              const edist = Math.sqrt(edx * edx + edy * edy);
              if (edist < 15) return null;

              const eux = edx / edist;
              const euy = edy / edist;
              const epx = -euy;
              const epy = eux;

              const isPay = edge.label.toLowerCase().includes("paid");
              const isSettle = edge.label.toLowerCase().includes("settled");
              const isHighlighted =
                !selectedNodeId || edge.source === selectedNodeId || edge.target === selectedNodeId;

              let strokeColor = colors.textMuted;
              if (isSettle) strokeColor = colors.success;
              else if (isPay) strokeColor = colors.accentPrimary;
              else strokeColor = colors.warning;

              // Node radius calculations to land arrow cleanly outside node
              const targetNode = nodes.find((n) => n.id === edge.target);
              const isTargetMember = targetNode?.type === "member";
              const targetRadius = isTargetMember ? NODE_RADIUS : 24;
              const targetDistAlongEdge = Math.max(
                12,
                Math.sqrt(Math.max(16, targetRadius * targetRadius - offset * offset))
              );

              const sourceNode = nodes.find((n) => n.id === edge.source);
              const isSourceMember = sourceNode?.type === "member";
              const sourceRadius = isSourceMember ? NODE_RADIUS : 24;
              const sourceDistAlongEdge = Math.max(
                12,
                Math.sqrt(Math.max(16, sourceRadius * sourceRadius - offset * offset))
              );

              // Arrow tip ends right outside target boundary
              const tipX = shiftedTarget.x - eux * (targetDistAlongEdge + 3);
              const tipY = shiftedTarget.y - euy * (targetDistAlongEdge + 3);

              // Arrowhead dimensions
              const arrowLength = 9;
              const arrowWidth = 5;
              const baseX = tipX - eux * arrowLength;
              const baseY = tipY - euy * arrowLength;

              const leftX = baseX + epx * arrowWidth;
              const leftY = baseY + epy * arrowWidth;
              const rightX = baseX - epx * arrowWidth;
              const rightY = baseY - epy * arrowWidth;

              // Line start lands right outside source boundary
              const startX = shiftedSource.x + eux * (sourceDistAlongEdge + 3);
              const startY = shiftedSource.y + euy * (sourceDistAlongEdge + 3);

              // Non-overlapping amount badge placement (staggered along the path)
              let t = 0.5;
              if (groupSize === 2) {
                t = indexInGroup === 0 ? 0.38 : 0.62;
              } else if (groupSize > 2) {
                t = 0.5 + (indexInGroup - (groupSize - 1) / 2) * 0.14;
              }
              t = Math.max(0.24, Math.min(0.76, t));

              const badgeX = shiftedSource.x + (shiftedTarget.x - shiftedSource.x) * t;
              const badgeY = shiftedSource.y + (shiftedTarget.y - shiftedSource.y) * t;

              const badgeLabel = `${formatMoney(edge.amountMinor, currency)} →`;
              const badgeWidth = Math.max(68, badgeLabel.length * 6.5 + 12);
              const badgeHeight = 20;

              return (
                <G key={edge.id} opacity={isHighlighted ? 1 : 0.2}>
                  {/* Directional Connecting Line from source to arrowhead base */}
                  <Line
                    x1={startX}
                    y1={startY}
                    x2={baseX}
                    y2={baseY}
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeDasharray={isSettle ? "5 3" : undefined}
                  />

                  {/* Directional Arrowhead pointing at target */}
                  <Polygon
                    points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
                    fill={strokeColor}
                  />

                  {/* Midpoint Amount Badge Background */}
                  <Rect
                    x={badgeX - badgeWidth / 2}
                    y={badgeY - badgeHeight / 2}
                    width={badgeWidth}
                    height={badgeHeight}
                    rx={5}
                    fill={colors.surface}
                    stroke={strokeColor}
                    strokeWidth={1}
                  />

                  {/* Midpoint Amount & Directional Arrow */}
                  <SvgText
                    x={badgeX}
                    y={badgeY + 3.5}
                    fontSize="9"
                    fontWeight="bold"
                    fill={colors.textPrimary}
                    textAnchor="middle"
                  >
                    {badgeLabel}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          {/* Draggable Node Views */}
          {nodes.map((node) => {
            const pos = positions[node.id] || { x: canvasWidth / 2, y: CANVAS_HEIGHT / 2 };
            const isSelected = selectedNodeId === node.id;
            const isMember = node.type === "member";
            const isSettlement = node.type === "settlement";

            const pan = panResponders[node.id];

            if (isMember) {
              return (
                <View
                  key={node.id}
                  {...(pan ? pan.panHandlers : {})}
                  style={[
                    styles.memberNode,
                    {
                      left: pos.x - NODE_RADIUS,
                      top: pos.y - NODE_RADIUS,
                      backgroundColor: isSelected ? colors.accentPrimary : colors.surface,
                      borderColor: isSelected ? colors.accentForeground : colors.border,
                      borderWidth: isSelected ? 2.5 : 1.5,
                    },
                  ]}
                >
                  <Ionicons
                    name="person"
                    size={16}
                    color={isSelected ? colors.accentForeground : colors.accentPrimary}
                  />
                  <Text
                    style={[
                      styles.memberNodeText,
                      { color: isSelected ? colors.accentForeground : colors.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {node.label}
                  </Text>
                </View>
              );
            }

            // Expense / Settlement node
            return (
              <View
                key={node.id}
                {...(pan ? pan.panHandlers : {})}
                style={[
                  styles.expenseNode,
                  {
                    left: pos.x - EXPENSE_NODE_WIDTH / 2,
                    top: pos.y - EXPENSE_NODE_HEIGHT / 2,
                    backgroundColor: isSettlement
                      ? colors.success
                      : isSelected
                      ? colors.accentPrimary
                      : colors.surface,
                    borderColor: isSelected ? colors.accentForeground : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <View style={styles.expenseNodeIconRow}>
                  <Ionicons
                    name={isSettlement ? "checkmark-circle-outline" : "receipt-outline"}
                    size={13}
                    color={
                      isSettlement
                        ? "#FFFFFF"
                        : isSelected
                        ? colors.accentForeground
                        : colors.accentPrimary
                    }
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.expenseNodeTitle,
                      {
                        color: isSettlement
                          ? "#FFFFFF"
                          : isSelected
                          ? colors.accentForeground
                          : colors.textPrimary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {node.label}
                  </Text>
                </View>
                {typeof node.data?.amountMinor === "number" && (
                  <Text
                    style={[
                      styles.expenseNodeAmount,
                      {
                        color: isSettlement
                          ? "#FFFFFF"
                          : isSelected
                          ? colors.accentForeground
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {formatMoney(node.data.amountMinor as number, currency)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Floating Zoom & Layout Controls Toolbar */}
        <View
          style={[
            styles.zoomToolbar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: tokens.radius.sm,
            },
          ]}
        >
          {/* Interaction Mode Toggle: Move Nodes vs Pan Canvas */}
          <TouchableOpacity
            onPress={() => setInteractionMode((m) => (m === "move" ? "pan" : "move"))}
            activeOpacity={0.7}
            style={[
              styles.modeToggleBtn,
              {
                backgroundColor:
                  interactionMode === "move" ? colors.accentPrimary : colors.surfaceSubtle,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name={interactionMode === "move" ? "hand-right" : "move"}
              size={12}
              color={interactionMode === "move" ? colors.accentForeground : colors.textSecondary}
              style={{ marginRight: 3 }}
            />
            <Text
              style={[
                styles.modeToggleText,
                {
                  color:
                    interactionMode === "move" ? colors.accentForeground : colors.textSecondary,
                },
              ]}
            >
              {interactionMode === "move" ? "Move" : "Pan"}
            </Text>
          </TouchableOpacity>

          <View style={[styles.zoomDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            onPress={handleZoomIn}
            activeOpacity={0.7}
            style={styles.zoomBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather name="plus" size={13} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResetZoomPan}
            activeOpacity={0.7}
            style={[styles.zoomLevelBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.zoomLevelText, { color: colors.textPrimary }]}>
              {Math.round(scale * 100)}%
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleZoomOut}
            activeOpacity={0.7}
            style={styles.zoomBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather name="minus" size={13} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={[styles.zoomDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            onPress={handleAutoLayout}
            activeOpacity={0.7}
            style={styles.autoLayoutBtn}
          >
            <Feather
              name="refresh-cw"
              size={11}
              color={colors.textSecondary}
              style={{ marginRight: 3 }}
            />
            <Text style={[styles.autoLayoutText, { color: colors.textSecondary }]}>Layout</Text>
          </TouchableOpacity>
        </View>

        {/* Interactive Helper Hint */}
        <View style={styles.hintBadge}>
          <Ionicons
            name={interactionMode === "move" ? "hand-right-outline" : "move"}
            size={11}
            color={colors.textMuted}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            {interactionMode === "move"
              ? "Drag nodes freely • Pinch / +/- to zoom • Switch to 'Pan' to scroll canvas"
              : "Drag anywhere to pan canvas • Pinch / +/- to zoom • Switch to 'Move' to drag nodes"}
          </Text>
        </View>
      </View>

      {/* Selected Node Details Card */}
      {selectedNode && (
        <View
          style={[
            styles.nodeDetailCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
            },
          ]}
        >
          <View style={styles.nodeDetailHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons
                name={selectedNode.type === "member" ? "person-circle" : "receipt"}
                size={20}
                color={colors.accentPrimary}
              />
              <Text style={[styles.nodeDetailTitle, { color: colors.textPrimary }]}>
                {selectedNode.label}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedNodeId(null)}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.nodeDetailSub, { color: colors.textSecondary }]}>
            Type: {selectedNode.type.toUpperCase()} • Active Flows:{" "}
            {edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length}
          </Text>
        </View>
      )}

      {/* Graph Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accentPrimary }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Funded →</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Share (Owed) →</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Settled →</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  canvasBox: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    alignSelf: "center",
  },
  memberNode: {
    position: "absolute",
    width: NODE_RADIUS * 2,
    height: NODE_RADIUS * 2,
    borderRadius: NODE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  memberNodeText: {
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: 48,
    textAlign: "center",
  },
  expenseNode: {
    position: "absolute",
    width: EXPENSE_NODE_WIDTH,
    height: EXPENSE_NODE_HEIGHT,
    paddingHorizontal: 8,
    paddingVertical: 5,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  expenseNodeIconRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  expenseNodeTitle: {
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  expenseNodeAmount: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  zoomToolbar: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  modeToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  modeToggleText: {
    fontSize: 10,
    fontWeight: "700",
  },
  zoomBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomLevelBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  zoomLevelText: {
    fontSize: 10,
    fontWeight: "700",
  },
  zoomDivider: {
    width: 1,
    height: 16,
    marginHorizontal: 4,
  },
  autoLayoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  autoLayoutText: {
    fontSize: 10,
    fontWeight: "600",
  },
  hintBadge: {
    position: "absolute",
    bottom: 8,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "92%",
  },
  hintText: {
    fontSize: 9.5,
  },
  nodeDetailCard: {
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  nodeDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nodeDetailTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  nodeDetailSub: {
    fontSize: 12,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "500",
  },
});

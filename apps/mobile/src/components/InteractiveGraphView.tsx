import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import Svg, { Line, Circle as SvgCircle, Rect, Text as SvgText, G } from 'react-native-svg';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { formatMoney, type DependencyGraphNode, type DependencyGraphEdge } from '@biyong/domain';

export interface InteractiveGraphViewProps {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
  currency?: string;
  activeFilter?: 'all' | 'pay' | 'share' | 'settle';
}

interface NodePosition {
  x: number;
  y: number;
}

const CANVAS_HEIGHT = 440;
const NODE_RADIUS = 28;
const EXPENSE_NODE_WIDTH = 90;
const EXPENSE_NODE_HEIGHT = 44;

export const InteractiveGraphView: React.FC<InteractiveGraphViewProps> = ({
  nodes,
  edges,
  currency = 'INR',
  activeFilter = 'all',
}) => {
  const { colors, tokens } = useAppTheme();
  const screenWidth = Dimensions.get('window').width;
  const canvasWidth = Math.max(320, screenWidth - 32);

  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Compute initial layout (circular / bipartite)
  const computeInitialLayout = () => {
    const newPositions: Record<string, NodePosition> = {};
    const memberNodes = nodes.filter((n) => n.type === 'member');
    const nonMemberNodes = nodes.filter((n) => n.type !== 'member');

    const centerX = canvasWidth / 2;
    const centerY = CANVAS_HEIGHT / 2;

    if (nodes.length <= 1) {
      if (nodes[0]) newPositions[nodes[0].id] = { x: centerX, y: centerY };
      return newPositions;
    }

    if (memberNodes.length > 0 && nonMemberNodes.length > 0) {
      // Members on top arc / row, expenses in middle/bottom
      const memberCount = memberNodes.length;
      const memberSpacing = Math.min(100, (canvasWidth - 60) / Math.max(1, memberCount));
      const memberStartX = centerX - ((memberCount - 1) * memberSpacing) / 2;

      memberNodes.forEach((node, idx) => {
        newPositions[node.id] = {
          x: Math.max(NODE_RADIUS + 10, Math.min(canvasWidth - NODE_RADIUS - 10, memberStartX + idx * memberSpacing)),
          y: 70 + (idx % 2 === 0 ? 0 : 25),
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
      // General circular distribution
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
    setPositions(computeInitialLayout());
    setSelectedNodeId(null);
  }, [nodes.map((n) => n.id).join(','), canvasWidth]);

  // Filtered edges
  const visibleEdges = useMemo(() => {
    return edges.filter((e) => {
      if (activeFilter === 'pay') return e.label.toLowerCase().includes('paid');
      if (activeFilter === 'share') return e.label.toLowerCase().includes('share');
      if (activeFilter === 'settle') return e.label.toLowerCase().includes('settled');
      return true;
    });
  }, [edges, activeFilter]);

  // Node pan responder generator
  const createPanResponder = (nodeId: string) => {
    let startX = 0;
    let startY = 0;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2;
      },
      onPanResponderGrant: () => {
        setSelectedNodeId(nodeId);
        const currentPos = positions[nodeId] || { x: canvasWidth / 2, y: CANVAS_HEIGHT / 2 };
        startX = currentPos.x;
        startY = currentPos.y;
      },
      onPanResponderMove: (_, gesture: PanResponderGestureState) => {
        const newX = Math.max(30, Math.min(canvasWidth - 30, startX + gesture.dx));
        const newY = Math.max(30, Math.min(CANVAS_HEIGHT - 30, startY + gesture.dy));
        setPositions((prev) => ({
          ...prev,
          [nodeId]: { x: newX, y: newY },
        }));
      },
      onPanResponderRelease: () => {
        // finished drag
      },
    });
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <View style={styles.container}>
      {/* Visual Canvas */}
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
      >
        {/* SVG Connections Layer */}
        <Svg style={StyleSheet.absoluteFill} width={canvasWidth} height={CANVAS_HEIGHT}>
          {visibleEdges.map((edge) => {
            const p1 = positions[edge.source];
            const p2 = positions[edge.target];
            if (!p1 || !p2) return null;

            const isPay = edge.label.toLowerCase().includes('paid');
            const isSettle = edge.label.toLowerCase().includes('settled');
            const isHighlighted =
              !selectedNodeId || edge.source === selectedNodeId || edge.target === selectedNodeId;

            let strokeColor = colors.textMuted;
            if (isSettle) strokeColor = colors.success;
            else if (isPay) strokeColor = colors.accentPrimary;
            else strokeColor = colors.warning;

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            return (
              <G key={edge.id} opacity={isHighlighted ? 1 : 0.2}>
                {/* Connecting Line */}
                <Line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={strokeColor}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isSettle ? '4 3' : undefined}
                />

                {/* Midpoint Amount Badge Background */}
                <Rect
                  x={midX - 32}
                  y={midY - 10}
                  width={64}
                  height={20}
                  rx={6}
                  fill={colors.surface}
                  stroke={strokeColor}
                  strokeWidth={1}
                />

                {/* Midpoint Amount Text */}
                <SvgText
                  x={midX}
                  y={midY + 4}
                  fontSize="9"
                  fontWeight="bold"
                  fill={colors.textPrimary}
                  textAnchor="middle"
                >
                  {formatMoney(edge.amountMinor, currency)}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {/* Draggable Node Views */}
        {nodes.map((node) => {
          const pos = positions[node.id] || { x: canvasWidth / 2, y: CANVAS_HEIGHT / 2 };
          const isSelected = selectedNodeId === node.id;
          const isMember = node.type === 'member';
          const isExpense = node.type === 'expense';
          const isSettlement = node.type === 'settlement';

          const pan = createPanResponder(node.id);

          if (isMember) {
            return (
              <View
                key={node.id}
                {...pan.panHandlers}
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
              {...pan.panHandlers}
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
                  name={isSettlement ? 'checkmark-circle-outline' : 'receipt-outline'}
                  size={13}
                  color={
                    isSettlement
                      ? '#FFFFFF'
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
                      color:
                        isSettlement
                          ? '#FFFFFF'
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
              {typeof node.data?.amountMinor === 'number' && (
                <Text
                  style={[
                    styles.expenseNodeAmount,
                    {
                      color:
                        isSettlement
                          ? '#FFFFFF'
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

        {/* Reset Layout Floating Button */}
        <TouchableOpacity
          onPress={() => setPositions(computeInitialLayout())}
          style={[
            styles.resetBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={[styles.resetBtnText, { color: colors.textSecondary }]}>Auto Layout</Text>
        </TouchableOpacity>

        {/* Interactive Helper Hint */}
        <View style={styles.hintBadge}>
          <Feather name="move" size={11} color={colors.textMuted} style={{ marginRight: 3 }} />
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            Drag nodes to explore flows
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={selectedNode.type === 'member' ? 'person-circle' : 'receipt'}
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
            Type: {selectedNode.type.toUpperCase()} • Incident Flows:{' '}
            {edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length}
          </Text>
        </View>
      )}

      {/* Graph Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accentPrimary }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Funded</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Share (Owed)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Settled</Text>
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
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    alignSelf: 'center',
  },
  memberNode: {
    position: 'absolute',
    width: NODE_RADIUS * 2,
    height: NODE_RADIUS * 2,
    borderRadius: NODE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  memberNodeText: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    maxWidth: 48,
    textAlign: 'center',
  },
  expenseNode: {
    position: 'absolute',
    width: EXPENSE_NODE_WIDTH,
    height: EXPENSE_NODE_HEIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  expenseNodeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseNodeTitle: {
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  expenseNodeAmount: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  resetBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  resetBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  hintBadge: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 10,
  },
  nodeDetailCard: {
    padding: 12,
    borderWidth: 1,
  },
  nodeDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nodeDetailTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  nodeDetailSub: {
    fontSize: 11,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

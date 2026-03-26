'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FamilyMember {
  id: number;
  name: string;
  parentId: number | null;
}

interface TreeNode {
  id: number;
  name: string;
  parentId: number | null;
  children: TreeNode[];
}

function buildTree(items: FamilyMember[], parentId: number | null = null): TreeNode[] {
  return items
    .filter(item => item.parentId === parentId)
    .map(item => ({
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      children: buildTree(items, item.id),
    }));
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((acc, child) => acc + 1 + countDescendants(child), 0);
}

function collectAllIds(nodes: TreeNode[]): Set<number> {
  const ids = new Set<number>();
  const walk = (ns: TreeNode[]) => ns.forEach(n => { ids.add(n.id); walk(n.children); });
  walk(nodes);
  return ids;
}

function getAncestorIds(nodeId: number, members: FamilyMember[]): Set<number> {
  const ids = new Set<number>();
  let cur = members.find(m => m.id === nodeId);
  while (cur?.parentId != null) {
    ids.add(cur.parentId);
    cur = members.find(m => m.id === cur!.parentId);
  }
  return ids;
}

const FamilyTreeOrgChart: React.FC = () => {
  const [familyData, setFamilyData] = useState<FamilyMember[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [editingNode, setEditingNode] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(100);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    fetch('/api/family-tree')
      .then(r => r.json())
      .then((data: FamilyMember[]) => {
        setFamilyData(data);
        nextIdRef.current = Math.max(0, ...data.map(m => m.id)) + 1;
        const roots = data.filter(m => m.parentId === null);
        setExpandedNodes(new Set(roots.map(r => r.id)));
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading family tree:', err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (editingNode !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingNode]);

  const treeData = useMemo(() => buildTree(familyData), [familyData]);

  const matchingIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matches = familyData.filter(m => m.name.toLowerCase().includes(q));
    const ids = new Set<number>();
    matches.forEach(m => {
      ids.add(m.id);
      getAncestorIds(m.id, familyData).forEach(id => ids.add(id));
    });
    return ids;
  }, [searchQuery, familyData]);

  useEffect(() => {
    if (matchingIds && matchingIds.size > 0) {
      setExpandedNodes(prev => {
        const next = new Set(prev);
        matchingIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [matchingIds]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setExpandedNodes(collectAllIds(treeData)), [treeData]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set(treeData.map(r => r.id)));
  }, [treeData]);

  const startEdit = useCallback((id: number, name: string) => {
    setEditingNode(id);
    setEditName(name);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingNode === null) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setFamilyData(prev => {
        const descIds = (pid: number): number[] => {
          const kids = prev.filter(m => m.parentId === pid);
          return [pid, ...kids.flatMap(k => descIds(k.id))];
        };
        return prev.filter(m => !new Set(descIds(editingNode)).has(m.id));
      });
    } else {
      setFamilyData(prev =>
        prev.map(m => (m.id === editingNode ? { ...m, name: trimmed } : m))
      );
    }
    setEditingNode(null);
  }, [editingNode, editName]);

  const cancelEdit = useCallback(() => {
    if (editingNode === null) return;
    setFamilyData(prev => {
      const node = prev.find(m => m.id === editingNode);
      if (node && !node.name.trim()) return prev.filter(m => m.id !== editingNode);
      return prev;
    });
    setEditingNode(null);
  }, [editingNode]);

  const handleAddMember = useCallback((parentId: number | null) => {
    const newId = nextIdRef.current++;
    setFamilyData(prev => [...prev, { id: newId, name: '', parentId }]);
    if (parentId !== null) {
      setExpandedNodes(prev => new Set([...prev, parentId]));
    }
    setEditingNode(newId);
    setEditName('');
  }, []);

  const handleRemoveMember = useCallback((id: number) => {
    if (!confirm('האם למחוק את השם הזה ואת כל הצאצאים שלו?')) return;
    setFamilyData(prev => {
      const descIds = (pid: number): number[] => {
        const kids = prev.filter(m => m.parentId === pid);
        return [pid, ...kids.flatMap(k => descIds(k.id))];
      };
      return prev.filter(m => !new Set(descIds(id)).has(m.id));
    });
    setEditingNode(prev => (prev === id ? null : prev));
  }, []);

  const saveTree = useCallback(async () => {
    try {
      const res = await fetch('/api/family-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(familyData),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast('העץ נשמר בהצלחה!');
    } catch {
      showToast('שגיאה בשמירה', 'error');
    }
  }, [familyData, showToast]);

  const downloadAsImage = useCallback(async () => {
    if (!treeRef.current) return;
    const saved = new Set(expandedNodes);
    setExpandedNodes(collectAllIds(treeData));
    await new Promise(r => setTimeout(r, 600));
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(treeRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#0a0e1a',
      });
      const a = document.createElement('a');
      a.download = 'family-tree.png';
      a.href = url;
      a.click();
      showToast('התמונה הורדה!');
    } catch {
      showToast('שגיאה בהורדת התמונה', 'error');
    }
    setExpandedNodes(saved);
  }, [expandedNodes, treeData, showToast]);

  const shouldShow = useCallback(
    (id: number) => !matchingIds || matchingIds.has(id),
    [matchingIds]
  );

  const isSearchMatch = useCallback(
    (id: number) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return false;
      const m = familyData.find(x => x.id === id);
      return m ? m.name.toLowerCase().includes(q) : false;
    },
    [searchQuery, familyData]
  );

  const renderNode = (
    node: TreeNode,
    isLast: boolean,
    guides: boolean[]
  ): React.ReactNode => {
    if (!shouldShow(node.id)) return null;

    const expanded = expandedNodes.has(node.id);
    const hasKids = node.children.length > 0;
    const editing = editingNode === node.id;
    const matched = isSearchMatch(node.id);
    const desc = countDescendants(node);
    const visibleKids = matchingIds
      ? node.children.filter(c => shouldShow(c.id))
      : node.children;

    return (
      <div key={node.id} id={`ft-node-${node.id}`}>
        {/* Row */}
        <div
          className={`ft-row${matched ? ' ft-row-match' : ''}${editing ? '' : ' ft-row-interactive'}`}
          onClick={() => {
            if (!editing && hasKids) toggleExpand(node.id);
          }}
        >
          {/* Ancestor guide columns */}
          {guides.map((show, i) => (
            <div key={i} className="ft-guide">
              {show && <div className="ft-guide-vline" />}
            </div>
          ))}

          {/* This node's connector */}
          {node.parentId !== null && (
            <div className="ft-guide">
              <div className={`ft-conn-v${isLast ? ' ft-conn-v-last' : ''}`} />
              <div className="ft-conn-h" />
            </div>
          )}

          {/* Expand chevron */}
          <div className="ft-expand">
            {hasKids && (
              <motion.svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                className="ft-chevron"
                animate={{ rotate: expanded ? 90 : 180 }}
                transition={{ duration: 0.15 }}
              >
                <path
                  d="M3 1L7 5L3 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </motion.svg>
            )}
          </div>

          {/* Avatar */}
          <div className="ft-avatar">🐕</div>

          {/* Name */}
          <div className="ft-name-area" dir="rtl">
            {editing ? (
              <input
                ref={editInputRef}
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                className="ft-name-input"
                dir="rtl"
                placeholder="שם..."
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className={`ft-name${matched ? ' ft-name-hl' : ''}`}>
                {node.name || '(ללא שם)'}
              </span>
            )}
          </div>

          {/* Descendant count */}
          {desc > 0 && !editing && <span className="ft-badge">{desc}</span>}

          {/* Edit actions */}
          {isEditMode && !editing && (
            <div className="ft-actions">
              <button
                className="ft-act"
                onClick={e => {
                  e.stopPropagation();
                  startEdit(node.id, node.name);
                }}
                title="ערוך שם"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
              </button>
              <button
                className="ft-act ft-act-add"
                onClick={e => {
                  e.stopPropagation();
                  handleAddMember(node.id);
                }}
                title="הוסף ילד"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              <button
                className="ft-act ft-act-del"
                onClick={e => {
                  e.stopPropagation();
                  handleRemoveMember(node.id);
                }}
                title="מחק"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          )}
        </div>

        {/* Children */}
        <AnimatePresence initial={false}>
          {expanded && visibleKids.length > 0 && (
            <motion.div
              key={`kids-${node.id}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.04, 0.62, 0.23, 0.98] }}
              style={{ overflow: 'hidden' }}
            >
              {visibleKids.map((child, i) =>
                renderNode(
                  child,
                  i === visibleKids.length - 1,
                  node.parentId !== null ? [...guides, !isLast] : guides
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  /* ── Loading skeleton ─────────────────────────────── */
  if (isLoading) {
    return (
      <div className="ft-container">
        <div className="ft-header">
          <div className="ft-skel-title" />
          <div className="ft-skel-subtitle" />
        </div>
        <div className="ft-tree">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="ft-skel-row"
              style={{ paddingInlineStart: `${Math.min(i * 20, 100)}px` }}
            >
              <div className="ft-skel-circle" />
              <div
                className="ft-skel-bar"
                style={{ width: `${60 + Math.random() * 80}px` }}
              />
            </div>
          ))}
        </div>
        <style>{STYLES}</style>
      </div>
    );
  }

  const totalMembers = familyData.length;
  const rootCount = treeData.length;
  const matchCount = matchingIds
    ? familyData.filter(m => m.name.toLowerCase().includes(searchQuery.trim().toLowerCase())).length
    : null;

  return (
    <div className="ft-container">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`ft-toast ${toast.type === 'error' ? 'ft-toast-err' : 'ft-toast-ok'}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="ft-header print-hide">
        <h1 className="ft-title">שמות האוליבון</h1>
        <p className="ft-subtitle">
          {totalMembers} שמות · {rootCount} {rootCount === 1 ? 'שורש' : 'שורשים'}
        </p>

        {/* Search */}
        <div className="ft-search-wrap">
          <svg
            className="ft-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="חיפוש שם..."
            className="ft-search"
            dir="rtl"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="ft-search-clear">
              ✕
            </button>
          )}
        </div>
        {matchCount !== null && (
          <p className="ft-match-count">
            {matchCount} {matchCount === 1 ? 'תוצאה' : 'תוצאות'}
          </p>
        )}

        {/* Controls */}
        <div className="ft-controls">
          <button onClick={expandAll} className="ft-ctrl">
            הרחב הכל
          </button>
          <button onClick={collapseAll} className="ft-ctrl">
            כווץ הכל
          </button>
          <div className="ft-ctrl-div" />
          <button onClick={saveTree} className="ft-ctrl ft-ctrl-gold">
            💾 שמור
          </button>
          <button onClick={downloadAsImage} className="ft-ctrl">
            📷 הורד כתמונה
          </button>
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`ft-ctrl ${isEditMode ? 'ft-ctrl-active' : ''}`}
          >
            {isEditMode ? '✓ סיום עריכה' : '✏️ עריכה'}
          </button>
        </div>
      </div>

      {/* Tree */}
      <div ref={treeRef} className="ft-tree">
        {treeData.length > 0 ? (
          treeData.map((root, i) =>
            renderNode(root, i === treeData.length - 1, [])
          )
        ) : (
          <div className="ft-empty">
            <div className="ft-empty-icon">🐕</div>
            <p>אין שמות בעץ המשפחה עדיין!</p>
            {isEditMode && (
              <button
                className="ft-empty-btn"
                onClick={() => handleAddMember(null)}
              >
                + הוסף שם ראשון
              </button>
            )}
          </div>
        )}
      </div>

      <style>{STYLES}</style>
    </div>
  );
};

/* ── Styles ──────────────────────────────────────────── */

const STYLES = `
/* Container */
.ft-container {
  max-width: 820px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

/* Header */
.ft-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.ft-title {
  font-size: 2rem;
  font-weight: 800;
  margin: 0 0 0.25rem;
  background: linear-gradient(135deg, #c9a84c 0%, #e8d5a3 50%, #c9a84c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.ft-subtitle {
  color: rgba(240, 236, 226, 0.35);
  font-size: 0.85rem;
  margin: 0 0 1.25rem;
}

/* Search */
.ft-search-wrap {
  position: relative;
  max-width: 380px;
  margin: 0 auto 0.75rem;
}

.ft-search-icon {
  position: absolute;
  inset-inline-start: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(201, 168, 76, 0.35);
  pointer-events: none;
}

.ft-search {
  width: 100%;
  padding: 0.6rem 2.5rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(201, 168, 76, 0.12);
  border-radius: 0.75rem;
  color: #f0ece2;
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.ft-search:focus {
  border-color: rgba(201, 168, 76, 0.35);
}

.ft-search::placeholder {
  color: rgba(240, 236, 226, 0.25);
}

.ft-search-clear {
  position: absolute;
  inset-inline-end: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(240, 236, 226, 0.3);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 4px;
  line-height: 1;
}

.ft-match-count {
  color: rgba(201, 168, 76, 0.5);
  font-size: 0.8rem;
  margin: 0 0 0.75rem;
}

/* Controls */
.ft-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.ft-ctrl {
  padding: 0.4rem 0.9rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.5rem;
  color: rgba(240, 236, 226, 0.55);
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.ft-ctrl:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(201, 168, 76, 0.2);
  color: #f0ece2;
}

.ft-ctrl-gold {
  border-color: rgba(201, 168, 76, 0.25);
  color: #c9a84c;
}

.ft-ctrl-gold:hover {
  background: rgba(201, 168, 76, 0.1);
  border-color: rgba(201, 168, 76, 0.4);
}

.ft-ctrl-active {
  background: rgba(201, 168, 76, 0.12);
  border-color: rgba(201, 168, 76, 0.3);
  color: #c9a84c;
}

.ft-ctrl-div {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 0.15rem;
}

/* Tree panel */
.ft-tree {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
  padding: 0.5rem 0.35rem;
  min-height: 120px;
}

/* ── Node row ───────────────────────────────── */
.ft-row {
  display: flex;
  align-items: center;
  height: 2.75rem;
  border-radius: 0.5rem;
  margin: 1px 2px;
  padding-inline-end: 8px;
  transition: background-color 0.15s;
  position: relative;
}

.ft-row-interactive {
  cursor: pointer;
}

.ft-row-interactive:hover {
  background: rgba(255, 255, 255, 0.03);
}

.ft-row-match {
  background: rgba(201, 168, 76, 0.06) !important;
}

/* ── Guide columns & connectors ─────────────── */
.ft-guide {
  width: 22px;
  height: 2.75rem;
  position: relative;
  flex-shrink: 0;
}

.ft-guide-vline {
  position: absolute;
  inset-inline-start: 10px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(201, 168, 76, 0.12);
}

.ft-conn-v {
  position: absolute;
  inset-inline-start: 10px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(201, 168, 76, 0.12);
}

.ft-conn-v-last {
  bottom: 50%;
}

.ft-conn-h {
  position: absolute;
  inset-inline-start: 10px;
  top: 50%;
  width: 12px;
  height: 1px;
  background: rgba(201, 168, 76, 0.12);
}

/* ── Expand chevron ─────────────────────────── */
.ft-expand {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ft-chevron {
  color: rgba(201, 168, 76, 0.35);
  transition: color 0.15s;
}

.ft-row-interactive:hover .ft-chevron {
  color: rgba(201, 168, 76, 0.65);
}

/* ── Avatar ─────────────────────────────────── */
.ft-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(201, 168, 76, 0.07);
  border: 1px solid rgba(201, 168, 76, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.9rem;
  margin-inline-start: 2px;
}

/* ── Name ───────────────────────────────────── */
.ft-name-area {
  flex: 1;
  min-width: 0;
  margin-inline: 10px;
}

.ft-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(240, 236, 226, 0.88);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.ft-name-hl {
  color: #c9a84c;
  font-weight: 600;
}

.ft-name-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(201, 168, 76, 0.35);
  border-radius: 6px;
  padding: 3px 10px;
  color: #f0ece2;
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.ft-name-input:focus {
  border-color: rgba(201, 168, 76, 0.55);
  background: rgba(255, 255, 255, 0.08);
}

/* ── Badge ──────────────────────────────────── */
.ft-badge {
  font-size: 0.7rem;
  color: rgba(240, 236, 226, 0.3);
  background: rgba(255, 255, 255, 0.04);
  padding: 1px 8px;
  border-radius: 10px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* ── Action buttons ─────────────────────────── */
.ft-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  margin-inline-start: 4px;
  flex-shrink: 0;
}

.ft-row:hover .ft-actions {
  opacity: 1;
}

.ft-act {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(240, 236, 226, 0.35);
  transition: all 0.15s;
  padding: 0;
}

.ft-act:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(240, 236, 226, 0.8);
}

.ft-act-add:hover {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.ft-act-del:hover {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

/* ── Empty state ────────────────────────────── */
.ft-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: rgba(240, 236, 226, 0.35);
}

.ft-empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.ft-empty-btn {
  margin-top: 1rem;
  padding: 0.55rem 1.5rem;
  background: rgba(201, 168, 76, 0.12);
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 0.6rem;
  color: #c9a84c;
  cursor: pointer;
  font-size: 0.875rem;
  font-family: inherit;
  transition: all 0.2s;
}

.ft-empty-btn:hover {
  background: rgba(201, 168, 76, 0.2);
  border-color: rgba(201, 168, 76, 0.5);
}

/* ── Toast ──────────────────────────────────── */
.ft-toast {
  position: fixed;
  top: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  padding: 0.65rem 1.5rem;
  border-radius: 0.75rem;
  font-size: 0.85rem;
  font-weight: 500;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.ft-toast-ok {
  background: rgba(74, 222, 128, 0.12);
  border: 1px solid rgba(74, 222, 128, 0.25);
  color: #4ade80;
}

.ft-toast-err {
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.25);
  color: #f87171;
}

/* ── Loading skeletons ──────────────────────── */
.ft-skel-title {
  width: 200px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  margin: 0 auto 8px;
  animation: ft-pulse 1.5s ease-in-out infinite;
}

.ft-skel-subtitle {
  width: 120px;
  height: 14px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
  margin: 0 auto 24px;
  animation: ft-pulse 1.5s ease-in-out infinite;
}

.ft-skel-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
}

.ft-skel-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
  animation: ft-pulse 1.5s ease-in-out infinite;
}

.ft-skel-bar {
  height: 14px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  animation: ft-pulse 1.5s ease-in-out infinite;
}

@keyframes ft-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Mobile ─────────────────────────────────── */
@media (max-width: 640px) {
  .ft-container {
    padding: 1rem 0.5rem 2rem;
  }

  .ft-title {
    font-size: 1.5rem;
  }

  .ft-subtitle {
    font-size: 0.8rem;
  }

  .ft-guide {
    width: 18px;
  }

  .ft-guide-vline,
  .ft-conn-v {
    inset-inline-start: 8px;
  }

  .ft-conn-h {
    inset-inline-start: 8px;
    width: 10px;
  }

  .ft-avatar {
    width: 26px;
    height: 26px;
    font-size: 0.8rem;
  }

  .ft-name {
    font-size: 0.82rem;
  }

  .ft-row {
    height: 2.5rem;
  }

  .ft-guide {
    height: 2.5rem;
  }

  .ft-controls {
    gap: 0.3rem;
  }

  .ft-ctrl {
    padding: 0.35rem 0.7rem;
    font-size: 0.75rem;
  }

  .ft-actions {
    opacity: 1;
  }

  .ft-act {
    width: 28px;
    height: 28px;
  }
}

/* ── Print ──────────────────────────────────── */
.print-hide {
  /* visible normally */
}

@media print {
  .print-hide {
    display: none !important;
  }

  .ft-tree {
    background: white;
    border: none;
  }

  .ft-name {
    color: #111 !important;
  }

  .ft-guide-vline,
  .ft-conn-v,
  .ft-conn-h {
    background: #d1d5db !important;
  }

  .ft-avatar {
    background: #f3f4f6;
    border-color: #e5e7eb;
  }

  .ft-badge {
    color: #6b7280;
    background: #f3f4f6;
  }
}
`;

export default FamilyTreeOrgChart;

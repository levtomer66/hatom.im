import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import styled from 'styled-components';

// Define interfaces for our data structures
interface FamilyMember {
  id: number;
  name: string;
  parentId: number | null;
  photo?: string; // Optional photo URL
  title?: string; // Optional title/role
}

interface TreeNodeData extends FamilyMember {
  children: TreeNodeData[];
}

// Styled components for the org chart
const StyledNode = styled.div`
  padding: 12px;
  border-radius: 4px;
  display: inline-block;
  border: 1px solid #e5e7eb;
  background-color: white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  min-width: 160px;
  position: relative;
  transition: all 0.2s;
  text-align: center;
  
  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
`;

const PhotoContainer = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #f3f4f6;
  margin: 0 auto 8px;
  overflow: hidden;
  border: 2px solid #e5e7eb;
`;

const Photo = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const DefaultPhoto = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #9ca3af;
`;

const NodeTitle = styled.h3`
  margin: 0;
  font-weight: 600;
  color: #111827;
  font-size: 1rem;
  text-align: center;
`;

const NodeSubtitle = styled.p`
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 0.875rem;
  text-align: center;
`;

const StyledTreeNode = styled(TreeNode)`
  padding-top: 10px;
  
  /* Fix for broken lines */
  .oc-tree-node-line {
    height: 10px !important;
  }
  
  .oc-tree-node-children {
    margin-top: 0 !important;
  }
`;

const StyledTree = styled(Tree)`
  text-align: center;
  
  /* Fix for broken lines */
  .oc-tree {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .oc-tree-node {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .oc-tree-node-children {
    display: flex;
    margin-top: 0;
  }
`;

const FamilyTreeOrgChart: React.FC = () => {
  const [familyData, setFamilyData] = useState<FamilyMember[]>([]);
  const [editingNode, setEditingNode] = useState<number | null>(null);
  const [newNodeName, setNewNodeName] = useState<string>('');
  const [newNodeTitle, setNewNodeTitle] = useState<string>('');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(new Set());
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const operationInProgressRef = useRef<boolean>(false);

  useEffect(() => {
    // Fetch the family tree data
    fetch('/api/family-tree')
      .then(response => response.json())
      .then(data => setFamilyData(data))
      .catch(error => console.error('Error loading family tree data:', error));
  }, []);

  // Function to build the tree structure from flat data
  const buildTree = useCallback((items: FamilyMember[], parentId: number | null = null): TreeNodeData[] => {
    // Create a recursive function inside the callback to avoid dependency issues
    const buildTreeRecursive = (items: FamilyMember[], currentParentId: number | null): TreeNodeData[] => {
      return items
        .filter(item => item.parentId === currentParentId)
        .map(item => ({
          ...item,
          children: buildTreeRecursive(items, item.id)
        }));
    };
    
    return buildTreeRecursive(items, parentId);
  }, []);

  // Function to add a new family member
  const handleAddMember = (parentId: number | null): void => {
    // Set operation flag to prevent unwanted state resets
    operationInProgressRef.current = true;
    
    const newId = Math.max(...familyData.map(item => item.id), 0) + 1;
    const newMember: FamilyMember = {
      id: newId,
      name: '',
      parentId: parentId,
      title: ''
    };

    // Create a deep copy of the current collapsed nodes to preserve state
    const currentCollapsedNodes = new Set([...collapsedNodes]);
    
    // Add the new member to the family data
    setFamilyData(prevData => [...prevData, newMember]);
    
    // If the parent exists, ensure it's expanded to show the new child
    if (parentId !== null) {
      currentCollapsedNodes.delete(parentId);
    }
    
    // Update collapsed nodes state with our preserved copy
    setCollapsedNodes(currentCollapsedNodes);
    
    // Set the new node to edit mode and scroll to it
    setEditingNode(newId);
    setNewNodeName('');
    setNewNodeTitle('');
    
    // Scroll to the new node after a short delay to ensure DOM is updated
    setTimeout(() => {
      const newNodeElement = document.getElementById(`node-${newId}`);
      if (newNodeElement) {
        newNodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Reset operation flag
      operationInProgressRef.current = false;
    }, 100);
  };

  // Function to save the edited name
  const handleSaveName = (): void => {
    if (!newNodeName.trim()) {
      // If name is empty, remove the node
      if (editingNode !== null) {
        handleRemoveMember(editingNode);
      }
    } else {
      // Update the node name and title
      setFamilyData(familyData.map(item => 
        item.id === editingNode ? { ...item, name: newNodeName, title: newNodeTitle } : item
      ));
    }
    setEditingNode(null);
  };

  // Function to handle key press in the edit input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setEditingNode(null);
    }
  };

  // Function to remove a family member and all their descendants
  const handleRemoveMember = (id: number): void => {
    // Set operation flag to prevent unwanted state resets
    operationInProgressRef.current = true;
    
    // Create a deep copy of the current collapsed nodes to preserve state
    const currentCollapsedNodes = new Set([...collapsedNodes]);
    
    // Get all descendant IDs recursively
    const getDescendantIds = (parentId: number): number[] => {
      const directChildren = familyData.filter(item => item.parentId === parentId);
      const childrenIds = directChildren.map(child => child.id);
      const descendantIds = childrenIds.flatMap(childId => getDescendantIds(childId));
      return [parentId, ...descendantIds];
    };

    const idsToRemove = getDescendantIds(id);
    
    // Remove the nodes from the family data
    setFamilyData(prevData => prevData.filter(item => !idsToRemove.includes(item.id)));
    
    // Remove the deleted nodes from the collapsed nodes set
    idsToRemove.forEach(nodeId => {
      currentCollapsedNodes.delete(nodeId);
    });
    
    // Update collapsed nodes state with our preserved copy
    setCollapsedNodes(currentCollapsedNodes);
    
    // If we're removing the node being edited, clear the editing state
    if (editingNode === id) {
      setEditingNode(null);
    }
    
    // Reset operation flag after a short delay
    setTimeout(() => {
      operationInProgressRef.current = false;
    }, 100);
  };

  // Function to get siblings of a node (nodes with the same parent)
  const getSiblingIds = (nodeId: number): number[] => {
    const node = familyData.find(item => item.id === nodeId);
    if (!node) return [];
    
    return familyData
      .filter(item => item.parentId === node.parentId && item.id !== nodeId)
      .map(item => item.id);
  };

  // Function to toggle collapse state of a node
  const toggleCollapse = (id: number): void => {
    setCollapsedNodes(prevCollapsed => {
      const newCollapsed = new Set(prevCollapsed);
      const isCurrentlyCollapsed = newCollapsed.has(id);
      
      if (isCurrentlyCollapsed) {
        // If the node is currently collapsed, expand it and collapse its siblings
        newCollapsed.delete(id);
        
        // Get all siblings and collapse them
        const siblingIds = getSiblingIds(id);
        siblingIds.forEach(siblingId => {
          newCollapsed.add(siblingId);
        });
      } else {
        // If the node is currently expanded, collapse it
        newCollapsed.add(id);
      }
      
      return newCollapsed;
    });
  };

  // Function to download the tree as an image
  const downloadAsImage = (): void => {
    if (!treeContainerRef.current) return;
    
    // First, get all collapsed nodes and expand them temporarily
    const tempCollapsedNodes = new Set(collapsedNodes);
    setCollapsedNodes(new Set()); // Expand all nodes
    
    // Use setTimeout to ensure the DOM has updated with expanded nodes
    setTimeout(() => {
      import('html-to-image')
        .then((htmlToImage) => {
          // Set specific options for better quality and full capture
          htmlToImage.toPng(treeContainerRef.current!, { 
            quality: 1.0,
            pixelRatio: 2,
            width: treeContainerRef.current!.scrollWidth,
            height: treeContainerRef.current!.scrollHeight,
            style: {
              transform: 'scale(1)',
              transformOrigin: 'top left',
              width: `${treeContainerRef.current!.scrollWidth}px`,
              height: `${treeContainerRef.current!.scrollHeight}px`,
            }
          })
            .then((dataUrl: string) => {
              const link = document.createElement('a');
              link.download = 'family-tree.png';
              link.href = dataUrl;
              link.click();
              
              // Restore collapsed nodes after download
              setCollapsedNodes(tempCollapsedNodes);
            })
            .catch((error: Error) => {
              console.error('Error generating image:', error);
              alert('Failed to generate image. Check console for details.');
              // Restore collapsed nodes if there's an error
              setCollapsedNodes(tempCollapsedNodes);
            });
        })
        .catch((error: Error) => {
          console.error('Error loading html-to-image:', error);
          alert('Failed to load image generation library.');
          // Restore collapsed nodes if there's an error
          setCollapsedNodes(tempCollapsedNodes);
        });
    }, 300); // Wait for DOM to update
  };

  // Function to save the tree data
  const saveTree = async (): Promise<void> => {
    try {
      const response = await fetch('/api/family-tree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(familyData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save tree');
      }
      
      alert('Family tree saved successfully!');
    } catch (error) {
      console.error('Error saving tree:', error);
      alert('Failed to save tree. Check console for details.');
    }
  };

  // Initialize collapsed nodes when family data is loaded - only on initial load
  useEffect(() => {
    // Skip initialization if an operation is in progress
    if (operationInProgressRef.current) return;
    
    if (familyData.length > 0) {
      // Only initialize if collapsedNodes is empty (first load)
      if (collapsedNodes.size === 0) {
        // Initially collapse all nodes that have children
        const nodesToCollapse = new Set<number>();
        
        // Function to process a node and its children - collapse ALL nodes with children
        const processNode = (node: TreeNodeData) => {
          // Collapse all nodes with children
          if (node.children.length > 0) {
            nodesToCollapse.add(node.id);
          }
          
          // Process all children
          node.children.forEach(child => {
            processNode(child);
          });
        };
        
        // Build the tree and process all nodes
        const tree = buildTree(familyData);
        tree.forEach(rootNode => {
          processNode(rootNode);
        });
        
        // Don't collapse the root nodes
        tree.forEach(rootNode => {
          nodesToCollapse.delete(rootNode.id);
        });
        
        setCollapsedNodes(nodesToCollapse);
      }
    }
  }, [familyData, buildTree, collapsedNodes.size]); // Only run when familyData changes and collapsedNodes is empty

  // Recursive component to render a tree node
  const renderTreeNode = (node: TreeNodeData) => {
    const isEditing = editingNode === node.id;
    const isCollapsed = collapsedNodes.has(node.id);
    const hasChildren = node.children.length > 0;

    // Separate handler specifically for the photo container
    const handlePhotoClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      // Only allow expand/collapse when not in edit mode
      if (hasChildren && !isEditing) {
        toggleCollapse(node.id);
      }
    };

    // Handler for clicking on the name/title area
    const handleNameClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (!isEditing) {
        setEditingNode(node.id);
        setNewNodeName(node.name);
        setNewNodeTitle(node.title || '');
      }
    };

    // Prevent any click on the node container from propagating
    const preventPropagation = (e: React.MouseEvent) => {
      e.stopPropagation();
    };

    return (
      <StyledTreeNode
        key={node.id}
        label={
          <div 
            id={`node-${node.id}`} 
            style={{ margin: '0 4px' }} 
            onClick={preventPropagation}
          >
            <StyledNode onClick={preventPropagation}>
              {/* Photo container - only this should trigger expand/collapse */}
              <PhotoContainer 
                onClick={handlePhotoClick}
                style={{ 
                  cursor: hasChildren ? 'pointer' : 'default',
                  opacity: isEditing ? 0.7 : 1 // Slightly dim the photo when in edit mode
                }}
              >
                {node.photo ? (
                  <Photo src={node.photo} alt={node.name} />
                ) : (
                  <DefaultPhoto>🐕</DefaultPhoto>
                )}
              </PhotoContainer>
              
              {isEditing ? (
                // Edit mode content
                <div 
                  onClick={preventPropagation}
                  className="edit-container"
                >
                  <input
                    type="text"
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={handleKeyPress}
                    className="bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500 w-full text-center mb-2"
                    placeholder="Name"
                    dir="rtl"
                    autoFocus
                    onClick={preventPropagation}
                  />
                  <input
                    type="text"
                    value={newNodeTitle}
                    onChange={(e) => setNewNodeTitle(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500 w-full text-center text-sm"
                    placeholder="Title/Description"
                    dir="rtl"
                    onClick={preventPropagation}
                  />
                </div>
              ) : (
                // Normal view - name/title with edit buttons if in edit mode
                <div className="node-content">
                  <div 
                    onClick={handleNameClick} 
                    style={{ cursor: 'pointer' }}
                  >
                    <NodeTitle>
                      {node.name}
                      {hasChildren && (
                        <span className="ml-2 text-gray-400 text-xs">
                          {isCollapsed ? '▼' : '▲'}
                        </span>
                      )}
                    </NodeTitle>
                    {node.title && <NodeSubtitle>{node.title}</NodeSubtitle>}
                  </div>
                  
                  {/* Action buttons - only shown when global edit mode is active */}
                  {isEditMode && (
                    <div 
                      className="button-container mt-2"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        e.preventDefault();
                        if (e.nativeEvent) {
                          e.nativeEvent.stopImmediatePropagation();
                          e.nativeEvent.preventDefault();
                        }
                      }}
                    >
                      {/* Use a div wrapper with onClick instead of a button to avoid event bubbling issues */}
                      <div
                        className="add-button bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-sm mr-2 cursor-pointer"
                        onClick={(e) => {
                          // Stop all event propagation
                          e.stopPropagation();
                          e.preventDefault();
                          if (e.nativeEvent) {
                            e.nativeEvent.stopImmediatePropagation();
                            e.nativeEvent.preventDefault();
                          }
                          
                          // Use requestAnimationFrame to ensure we're outside the current render cycle
                          requestAnimationFrame(() => {
                            handleAddMember(node.id);
                          });
                          
                          return false;
                        }}
                      >
                        הוסף ילד
                      </div>
                      <div
                        className="remove-button bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1 text-sm cursor-pointer"
                        onClick={(e) => {
                          // Stop all event propagation
                          e.stopPropagation();
                          e.preventDefault();
                          if (e.nativeEvent) {
                            e.nativeEvent.stopImmediatePropagation();
                            e.nativeEvent.preventDefault();
                          }
                          
                          // Use requestAnimationFrame to ensure we're outside the current render cycle
                          requestAnimationFrame(() => {
                            handleRemoveMember(node.id);
                          });
                          
                          return false;
                        }}
                      >
                        הסר
                      </div>
                    </div>
                  )}
                </div>
              )}
            </StyledNode>
          </div>
        }
      >
        {!isCollapsed && node.children.map(childNode => renderTreeNode(childNode))}
      </StyledTreeNode>
    );
  };

  // Build the tree structure
  const treeData = buildTree(familyData);

  // Add some additional styles to ensure buttons work correctly
  const additionalStyles = `
    .button-container {
      display: flex;
      justify-content: center;
      margin-top: 8px;
      position: relative;
      z-index: 10;
      pointer-events: auto;
    }
    
    .edit-container {
      position: relative;
      z-index: 5;
    }
    
    .node-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }
    
    /* Style for button-like divs */
    .add-button, .remove-button {
      display: inline-block;
      text-align: center;
      position: relative;
      z-index: 20;
      cursor: pointer;
      pointer-events: auto;
      user-select: none;
    }
    
    /* Prevent click events from bubbling through buttons */
    .button-container div {
      isolation: isolate;
    }
  `;

  return (
    <div className="family-tree-container p-8 max-w-full overflow-auto print:p-0 bg-gray-50 min-h-screen">
      <div className="controls mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">
          שמות האוליבון
        </h1>
        <div className="flex flex-wrap gap-4 justify-center mb-4">
          <button 
            onClick={saveTree}
            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span className="mr-2">💾</span>
            שמירה
          </button>
          
          <button 
            onClick={() => window.print()}
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span className="mr-2">🖨️</span>
            הדפס
          </button>
          
          <button 
            onClick={downloadAsImage}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span className="mr-2">📷</span>
            הורד כתמונה
          </button>
          
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-4 py-2 rounded-md flex items-center ${
              isEditMode 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
            }`}
          >
            <span className="mr-2">{isEditMode ? '✓' : '✏️'}</span>
            {isEditMode ? 'צא ממצב עריכה' : 'הכנס למצב עריכה'}
          </button>
        </div>
      </div>

      <div className="instructions bg-blue-50 p-4 rounded-md mb-6 print:hidden text-center">
        <p className="text-blue-800">
          <span className="font-bold">הוראות:</span> 
          לחצו על תמונה כדי להרחיב/לכווץ תחתונים. לחצו על שם כדי לערוך אותו. 
          {isEditMode ? (
            <span> השימוש בכפתורים להוספת ילד ולהסרת ילד.</span>
          ) : (
            <span> לחצו על &quot;הכנס למצב עריכה&quot; כדי להציג אפשרויות הוספה והסרה.</span>
          )}
        </p>
      </div>

      <div 
        ref={treeContainerRef}
        className="tree-wrapper bg-white p-8 rounded-md shadow-md print:bg-white print:shadow-none border border-gray-200 overflow-x-auto"
      >
        <div className="min-w-max flex justify-center">
          {treeData.length > 0 ? (
            <StyledTree
              lineWidth={'1px'}
              lineColor={'#d1d5db'}
              lineBorderRadius={'0px'}
              nodePadding={'2px'}
              lineHeight={'10px'}
              label={<div className="text-gray-500 font-medium mb-2">משפחת הבונים</div>}
            >
              {treeData.map(rootNode => renderTreeNode(rootNode))}
            </StyledTree>
          ) : (
            <div className="text-center">
              <p className="text-gray-500 text-lg mb-4">אין שמות בעץ המשפחה עדיין!</p>
              <button 
                onClick={() => handleAddMember(null)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center mx-auto"
              >
                <span className="mr-2">+</span>
                הוספת שם ראשון
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @media print {
          .family-tree-container {
            width: 100%;
            height: 100%;
            background-color: white;
          }
          .tree-wrapper {
            width: 100%;
            border: none;
          }
        }
      `}</style>
      
      {/* Global styles to fix the org chart lines */}
      <style jsx global>{`
        .oc-tree {
          padding: 10px 0;
        }
        
        .oc-tree-node {
          padding: 0;
        }
        
        .oc-tree-node-children {
          margin-top: 0 !important;
          padding-top: 10px;
        }
        
        .oc-tree-node-line {
          height: 10px !important;
        }
        
        /* Reduce spacing between siblings */
        .oc-hierarchy {
          gap: 5px !important;
        }
        
        /* Additional styles for button handling */
        ${additionalStyles}
      `}</style>
    </div>
  );
};

export default FamilyTreeOrgChart; 
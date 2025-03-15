import React, { useState, useEffect, useRef } from 'react';
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

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 4px;
  gap: 4px;
`;

const Button = styled.button`
  border: none;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
`;

const AddButton = styled(Button)`
  background-color: #0ea5e9;
  &:hover {
    background-color: #0284c7;
  }
`;

const RemoveButton = styled(Button)`
  background-color: #ef4444;
  &:hover {
    background-color: #dc2626;
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

  useEffect(() => {
    // Fetch the family tree data
    fetch('/api/family-tree')
      .then(response => response.json())
      .then(data => setFamilyData(data))
      .catch(error => console.error('Error loading family tree data:', error));
  }, []);

  // Function to build the tree structure from flat data
  const buildTree = (items: FamilyMember[], parentId: number | null = null): TreeNodeData[] => {
    return items
      .filter(item => item.parentId === parentId)
      .map(item => ({
        ...item,
        children: buildTree(items, item.id)
      }));
  };

  // Function to add a new family member
  const handleAddMember = (parentId: number | null): void => {
    const newId = Math.max(...familyData.map(item => item.id), 0) + 1;
    const newMember: FamilyMember = {
      id: newId,
      name: '',
      parentId: parentId,
      title: ''
    };

    // First, get the current state of collapsed nodes
    const currentCollapsedNodes = new Set(collapsedNodes);
    
    // Add the new member to the family data
    setFamilyData(prevData => [...prevData, newMember]);
    
    // Ensure the parent node is expanded to show the new child
    // but maintain the collapsed state of all other nodes
    setCollapsedNodes(currentCollapsedNodes);
    
    // Then in a separate update, just expand the parent if it exists
    setTimeout(() => {
      if (parentId !== null) {
        setCollapsedNodes(prev => {
          const newCollapsed = new Set(prev);
          newCollapsed.delete(parentId);
          return newCollapsed;
        });
      }
      
      // Set the new node to edit mode
      setEditingNode(newId);
      setNewNodeName('');
      setNewNodeTitle('');
      
      // Scroll to the new node
      setTimeout(() => {
        const newNodeElement = document.getElementById(`node-${newId}`);
        if (newNodeElement) {
          newNodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }, 0);
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
    // Get all descendant IDs recursively
    const getDescendantIds = (parentId: number): number[] => {
      const directChildren = familyData.filter(item => item.parentId === parentId);
      const childrenIds = directChildren.map(child => child.id);
      const descendantIds = childrenIds.flatMap(childId => getDescendantIds(childId));
      return [parentId, ...descendantIds];
    };

    const idsToRemove = getDescendantIds(id);
    setFamilyData(familyData.filter(item => !idsToRemove.includes(item.id)));
    
    // If we're removing the node being edited, clear the editing state
    if (editingNode === id) {
      setEditingNode(null);
    }
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

  // Initialize collapsed nodes when family data is loaded
  useEffect(() => {
    if (familyData.length > 0) {
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
  }, []); // Only run once on initial load

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

    // Handler for adding a child node
    const handleAddClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      handleAddMember(node.id);
      return false;
    };

    // Handler for removing a node
    const handleRemoveClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      handleRemoveMember(node.id);
      return false;
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
                          {isCollapsed ? "▼" : "▲"}
                        </span>
                      )}
                    </NodeTitle>
                    {node.title && <NodeSubtitle>{node.title}</NodeSubtitle>}
                  </div>
                  
                  {/* Action buttons - only shown when global edit mode is active */}
                  {isEditMode && (
                    <div 
                      className="button-container mt-2"
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <button
                        className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-sm mr-2"
                        onClick={handleAddClick}
                        onMouseDown={(e) => { e.stopPropagation(); }}
                        onMouseUp={(e) => { e.stopPropagation(); }}
                        type="button"
                      >
                        Add Child
                      </button>
                      <button
                        className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1 text-sm"
                        onClick={handleRemoveClick}
                        onMouseDown={(e) => { e.stopPropagation(); }}
                        onMouseUp={(e) => { e.stopPropagation(); }}
                        type="button"
                      >
                        Remove
                      </button>
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
    
    /* Ensure buttons are clickable */
    button {
      position: relative;
      z-index: 20;
      cursor: pointer;
    }
  `;

  return (
    <div className="family-tree-container p-8 max-w-full overflow-auto print:p-0 bg-gray-50 min-h-screen">
      <div className="controls mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">
          Family Tree
        </h1>
        <div className="flex flex-wrap gap-4 justify-center mb-4">
          <button 
            onClick={saveTree}
            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span className="mr-2">💾</span>
            Save Tree
          </button>
          
          <button 
            onClick={() => window.print()}
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span className="mr-2">🖨️</span>
            Print
          </button>
          
          <button 
            onClick={downloadAsImage}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span className="mr-2">📷</span>
            Download as Image
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
            {isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
          </button>
        </div>
      </div>

      <div className="instructions bg-blue-50 p-4 rounded-md mb-6 print:hidden text-center">
        <p className="text-blue-800">
          <span className="font-bold">Instructions:</span> 
          Click on a photo to expand/collapse branches. Click on a name to edit it. 
          {isEditMode ? (
            <span> Use the Add Child and Remove buttons to modify the tree structure.</span>
          ) : (
            <span> Click "Enter Edit Mode" to show add/remove options.</span>
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
              label={<div className="text-gray-500 font-medium mb-2">Organization Chart</div>}
            >
              {treeData.map(rootNode => renderTreeNode(rootNode))}
            </StyledTree>
          ) : (
            <div className="text-center">
              <p className="text-gray-500 text-lg mb-4">No members in the family tree yet!</p>
              <button 
                onClick={() => handleAddMember(null)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center mx-auto"
              >
                <span className="mr-2">+</span>
                Add First Member
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
declare module '@unicef/react-org-chart' {
    import { ComponentType, ReactNode } from 'react';
  
    interface Person {
      id: number;
      avatar: string;
      department?: string;
      name: string;
      title: string;
      totalReports?: number;
      email?: string;
    }
  
    interface TreeNode {
      id: number;
      person: Person;
      hasChild?: boolean;
      hasParent?: boolean;
      isHighlight?: boolean;
      children?: TreeNode[];
    }
  
    interface OrgChartProps {
      tree: TreeNode;
      downloadImageId?: string;
      downloadPdfId?: string;
      zoomInId?: string;
      zoomOutId?: string;
      zoomExtentId?: string;
      onConfigChange?: (config: any) => void;
      loadConfig?: (d: any) => any;
      loadParent?: (personData: Person) => Promise<TreeNode>;
      loadChildren?: (personData: Person) => Promise<TreeNode[]>;
      loadImage?: (personData: Person) => Promise<string>;
      // Custom props for our implementation
      nodeWidth?: number;
      nodeHeight?: number;
      renderNode?: (node: TreeNode) => ReactNode;
      onNodeClick?: (nodeId: number) => void;
    }
  
    const OrgChart: ComponentType<OrgChartProps>;
  
    export default OrgChart;
  }
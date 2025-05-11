import React from "react";
import { Button } from "@/components/ui/button";

const TopBar = () => {
  return (
    <div className="flex justify-between items-center px-6 py-4 border-b">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">DeineTuer Voice Assistant Console</h1>
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" size="sm">
        </Button>
      </div>
    </div>
  );
};

export default TopBar;

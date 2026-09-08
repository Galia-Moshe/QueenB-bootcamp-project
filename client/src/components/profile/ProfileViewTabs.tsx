import React from "react";
import ViewRoleTabs, { type ViewRole } from "../ui/ViewRoleTabs";

type ProfileViewTabsProps = {
  value: ViewRole;
  onChange: (role: ViewRole) => void;
};

export default function ProfileViewTabs({ value, onChange }: ProfileViewTabsProps) {
  return (
    <ViewRoleTabs
      value={value}
      onChange={onChange}
      ariaLabel="תצוגת אזור אישי"
      menteeLabel="בתור מנטית"
      mentorLabel="בתור מנטורית"
    />
  );
}

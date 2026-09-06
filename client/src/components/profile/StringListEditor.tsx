import React, { KeyboardEvent, useState } from "react";
import { Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

type StringListEditorProps = {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
};

export default function StringListEditor({
  label,
  value,
  onChange,
  placeholder,
}: StringListEditorProps) {
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const nextItem = draft.trim();

    if (!nextItem || value.includes(nextItem)) {
      setDraft("");
      return;
    }

    onChange([...value, nextItem]);
    setDraft("");
  };

  const removeItem = (item: string) => {
    onChange(value.filter((currentItem) => currentItem !== item));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addDraft();
    }
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" sx={{ color: "primary.dark", fontWeight: 800 }}>
        {label}
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          fullWidth
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addDraft}
          sx={{ minWidth: { xs: "100%", sm: 104 } }}
        >
          הוספה
        </Button>
      </Stack>

      {value.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {value.map((item) => (
            <Chip key={item} label={item} onDelete={() => removeItem(item)} />
          ))}
        </Box>
      )}
    </Stack>
  );
}

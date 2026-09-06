import React from "react";
import {
  Autocomplete,
  Box,
  Button,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  ListSubheader,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CATEGORIZED_TOPICS, TOPIC_TO_CATEGORY } from "../../constants/topics";

export type MentorFiltersState = {
  jobTitle: string;
  topics: string[];
  yearsRange: [number, number];
  availability: boolean;
};

export const DEFAULT_YEARS_RANGE: [number, number] = [0, 20];

export const emptyMentorFilters: MentorFiltersState = {
  jobTitle: "",
  topics: [],
  yearsRange: [...DEFAULT_YEARS_RANGE],
  availability: false,
};

type MentorFiltersDrawerProps = {
  open: boolean;
  draft: MentorFiltersState;
  onClose: () => void;
  onDraftChange: (next: MentorFiltersState) => void;
  onApply: () => void;
  onClearFilters: () => void;
};

export default function MentorFiltersDrawer({
  open,
  draft,
  onClose,
  onDraftChange,
  onApply,
  onClearFilters,
}: MentorFiltersDrawerProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 360 } } }}>
      <Box sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6">סינון מנטוריות</Typography>
          <IconButton onClick={onClose} aria-label="סגירת סינון">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Stack spacing={3} sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
          <TextField
            label="תפקיד"
            value={draft.jobTitle}
            onChange={(event) => onDraftChange({ ...draft, jobTitle: event.target.value })}
            fullWidth
            placeholder="לדוגמה: Full Stack"
          />

          <Autocomplete
            multiple
            options={[...CATEGORIZED_TOPICS]}
            groupBy={(option) => TOPIC_TO_CATEGORY[option] ?? "Other"}
            value={draft.topics}
            onChange={(_event, value) => onDraftChange({ ...draft, topics: value })}
            renderGroup={(params) => (
              <li key={params.key}>
                <ListSubheader
                  component="div"
                  sx={{
                    position: "sticky",
                    top: -8,
                    bgcolor: "background.paper",
                    fontWeight: 800,
                    color: "primary.dark",
                    lineHeight: 2.2,
                  }}
                >
                  {params.group}
                </ListSubheader>
                <ul style={{ padding: 0 }}>{params.children}</ul>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="נושאים" placeholder="בחרי נושאים לפי קטגוריה" />
            )}
          />

          <Box>
            <Typography gutterBottom>שנות ניסיון</Typography>
            <Slider
              value={draft.yearsRange}
              onChange={(_event, value) =>
                onDraftChange({ ...draft, yearsRange: value as [number, number] })
              }
              valueLabelDisplay="auto"
              min={DEFAULT_YEARS_RANGE[0]}
              max={DEFAULT_YEARS_RANGE[1]}
              marks={[
                { value: 0, label: "0" },
                { value: 10, label: "10" },
                { value: 20, label: "20+" },
              ]}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={draft.availability}
                onChange={(event) => onDraftChange({ ...draft, availability: event.target.checked })}
              />
            }
            label="רק מנטוריות עם זמינות"
          />
        </Stack>

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1.5}>
            <Button variant="contained" fullWidth onClick={onApply}>
              החלי סינון
            </Button>
          </Stack>
          <Button variant="outlined" color="inherit" fullWidth onClick={onClearFilters}>
            נקה סינון
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}

import React from "react";
import { Box, Chip, Stack } from "@mui/material";

type TopicSelectorProps = {
  options: string[];
  selectedTopics: string[];
  onToggle: (topic: string) => void;
};

function getTopicDirection(topic: string) {
  return /[A-Za-z]/.test(topic) ? "ltr" : "rtl";
}

function getTopicChipSx(selected: boolean) {
  return {
    height: "auto",
    minHeight: 38,
    px: 0.5,
    borderWidth: 1,
    fontWeight: selected ? 900 : 800,
    boxShadow: selected ? "0 10px 22px rgba(255, 126, 165, 0.28)" : "none",
    "& .MuiChip-label": {
      px: 1.25,
      py: 0.7,
      whiteSpace: "normal",
      lineHeight: 1.35,
    },
    ...(selected
      ? {
          backgroundColor: "primary.main",
          borderColor: "primary.main",
          color: "primary.contrastText",
          "&:hover": {
            backgroundColor: "primary.dark",
            borderColor: "primary.dark",
            color: "primary.contrastText",
            boxShadow: "0 12px 26px rgba(229, 104, 143, 0.32)",
          },
          "&:focus-visible": {
            backgroundColor: "primary.dark",
            borderColor: "primary.dark",
            color: "primary.contrastText",
          },
        }
      : {
          backgroundColor: "#ffffff",
          borderColor: "secondary.main",
          color: "text.primary",
          "&:hover": {
            backgroundColor: "background.default",
            borderColor: "primary.main",
            color: "text.primary",
          },
        }),
  };
}

export default function TopicSelector({ options, selectedTopics, onToggle }: TopicSelectorProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      flexWrap="wrap"
      sx={{
        justifyContent: { xs: "flex-start", md: "center" },
      }}
    >
      {options.map((topic) => {
        const selected = selectedTopics.includes(topic);

        return (
          <Chip
            key={topic}
            label={
              <Box component="span" dir={getTopicDirection(topic)}>
                {topic}
              </Box>
            }
            clickable
            onClick={() => onToggle(topic)}
            color={selected ? "primary" : "default"}
            variant={selected ? "filled" : "outlined"}
            sx={getTopicChipSx(selected)}
          />
        );
      })}
    </Stack>
  );
}

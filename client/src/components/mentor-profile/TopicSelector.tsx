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
    boxShadow: selected ? "0 10px 22px rgba(216, 27, 96, 0.26)" : "none",
    "& .MuiChip-label": {
      px: 1.25,
      py: 0.7,
      whiteSpace: "normal",
      lineHeight: 1.35,
    },
    ...(selected
      ? {
          backgroundColor: "#d81b60",
          borderColor: "#d81b60",
          color: "#ffffff",
          "&:hover": {
            backgroundColor: "#ad1457",
            borderColor: "#ad1457",
            color: "#ffffff",
            boxShadow: "0 12px 26px rgba(173, 20, 87, 0.3)",
          },
          "&:focus-visible": {
            backgroundColor: "#ad1457",
            borderColor: "#ad1457",
            color: "#ffffff",
          },
        }
      : {
          backgroundColor: "#ffffff",
          borderColor: "#f8bbd0",
          color: "#ad1457",
          "&:hover": {
            backgroundColor: "#fff0f5",
            borderColor: "#ec407a",
            color: "#ad1457",
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

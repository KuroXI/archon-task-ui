import React from "react";
import { Box, Text } from "ink";

export function Header(): React.ReactElement {
  return (
    <Box backgroundColor="blue" flexDirection="row" justifyContent="space-between" paddingX={1}>
      <Text bold color="white">
        ARCHON TASK UI
      </Text>
      <Text color="white">
        {"[↑↓] select  [tab] switch tab  [r] refresh  [q] quit"}
      </Text>
    </Box>
  );
}

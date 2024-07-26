import React, { useState } from 'react';
import { Button, MenuItem, Paper, Box, TextField } from "@mui/material";
import { Dropdown as MuiDropdown } from '../atoms/DropdownMui';
import styled from "styled-components";
import { ActionSettings } from "../molecules/ActionSettings";
import { SelectChangeEvent } from "@mui/material/Select/Select";
import { SimpleBox } from "../atoms/Box";
import Typography from "@mui/material/Typography";
import { useGlobalInfoStore } from "../../context/globalInfo";
import { PairForEdit } from "../../pages/RecordingPage";
import { useActionContext } from '../../context/browserActions';
import { useBrowserSteps } from '../../context/browserSteps';

interface RightSidePanelProps {
  pairForEdit: PairForEdit;
}

interface BrowserStep {
  id: number;
  label: string;
  description: string;
}

export const RightSidePanel = ({ pairForEdit }: RightSidePanelProps) => {
  const [content, setContent] = useState<string>('action');
  const [action, setAction] = useState<string>('');
  const [isSettingsDisplayed, setIsSettingsDisplayed] = useState<boolean>(false);
  const [labels, setLabels] = useState<{ [id: number]: string }>({});
  

  const { lastAction } = useGlobalInfoStore();
  const { getText, getScreenshot, startGetText, stopGetText, startGetScreenshot, stopGetScreenshot } = useActionContext();
  const { browserSteps, updateBrowserStepLabel, deleteBrowserStep } = useBrowserSteps();

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setContent(newValue);
  };

  const handleActionSelect = (event: SelectChangeEvent) => {
    const { value } = event.target;
    setAction(value);
    setIsSettingsDisplayed(true);
  };

  // const confirmStep = () => {
  //   setBrowserSteps([
  //     ...browserSteps,
  //     { id: Date.now(), label: stepLabel, description: stepDescription }
  //   ]);
  //   setStepLabel('');
  //   setStepDescription('');
  // };

  // const discardStep = () => {
  //   setStepLabel('');
  //   setStepDescription('');
  // };

  const handleLabelChange = (id: number, label: string) => {
    setLabels(prevLabels => ({ ...prevLabels, [id]: label }));
};

const handleConfirm = (id: number) => {
    if (labels[id]) {
      updateBrowserStepLabel(id, labels[id]);
    }
};

const handleDiscard = (id: number) => {
    deleteBrowserStep(id);
};

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        width: '100%',
        backgroundColor: 'white',
        alignItems: "center",
      }}>
      <SimpleBox height={60} width='100%' background='lightGray' radius='0%'>
        <Typography sx={{ padding: '10px' }}>
          Last action:
          {` ${lastAction}`}
        </Typography>
      </SimpleBox>

      {content === 'action' ? (
        <React.Fragment>
          <ActionDescription>Type of action:</ActionDescription>
          <ActionTypeWrapper>
            <MuiDropdown
              id="action"
              label="Action"
              value={action}
              handleSelect={handleActionSelect}>
              <MenuItem value="mouse.click">click on coordinates</MenuItem>
              <MenuItem value="enqueueLinks">enqueueLinks</MenuItem>
              <MenuItem value="scrape">scrape</MenuItem>
              <MenuItem value="scrapeSchema">scrapeSchema</MenuItem>
              <MenuItem value="screenshot">screenshot</MenuItem>
              <MenuItem value="script">script</MenuItem>
              <MenuItem value="scroll">scroll</MenuItem>
            </MuiDropdown>
          </ActionTypeWrapper>

          {isSettingsDisplayed &&
            <ActionSettings action={action} />
          }
        </React.Fragment>
      ) : null}

      <Box display="flex" flexDirection="column" gap={2} style={{ margin: '15px' }}>
        {!getText && !getScreenshot && (
          <Button variant="contained" onClick={startGetText}>
            Capture Text
          </Button>
        )}
        {getText && (
          <Button variant="contained" onClick={stopGetText}>
            Stop Capture Text
          </Button>
        )}

        {!getText && !getScreenshot && (
          <Button variant="contained" onClick={startGetScreenshot}>
            Capture Screenshot
          </Button>
        )}
        {getScreenshot && (
          <Button variant="contained" onClick={stopGetScreenshot}>
            Stop Capture Screenshot
          </Button>
        )}
      </Box>

      <Box>
            {browserSteps.map(step => (
                <Box key={step.id} sx={{ border: '1px solid black', padding: '10px', marginBottom: '10px' }}>
                    <TextField
                        label="Label"
                        value={labels[step.id] || step.label || ''}
                        onChange={(e) => handleLabelChange(step.id, e.target.value)}
                        fullWidth
                        margin="normal"
                    />
                    <Typography variant="h6">Description: {step.value}</Typography>
                    <Box display="flex" justifyContent="space-between" gap={2}>
                        <Button variant="contained" onClick={() => handleConfirm(step.id)}>
                            Confirm
                        </Button>
                        <Button variant="contained" onClick={() => handleDiscard(step.id)}>
                            Discard
                        </Button>
                    </Box>
                </Box>
            ))}
        </Box>
    </Paper>
  );
};

const ActionTypeWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
`;

export const ActionDescription = styled.p`
  margin-left: 15px;
`;
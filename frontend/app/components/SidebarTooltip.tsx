import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function SidebarTooltip({ title }: { title: string }) {
  return (
    <Tooltip
      title={title}
      arrow
      placement="right"
      slotProps={{
        popper: {
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 8],
              },
            },
          ],
        },
        tooltip: {
          sx: {
            bgcolor: '#222',
            color: '#fff',
            fontSize: 14,
            borderRadius: 1,
            boxShadow: 3,
            px: 2,
            py: 1,
          }
        }
      }}
    >
      <span className="ml-auto flex items-center cursor-help">
        <InfoOutlinedIcon fontSize="small" />
      </span>
    </Tooltip>
  );
}

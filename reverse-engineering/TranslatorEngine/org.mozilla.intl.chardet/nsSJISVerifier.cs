namespace org.mozilla.intl.chardet;

public class nsSJISVerifier : nsVerifier
{
	private static int[] m_cclass;

	private static int[] m_states;

	private static int m_stFactor;

	private static string m_charset;

	public override int[] cclass()
	{
		return m_cclass;
	}

	public override int[] states()
	{
		return m_states;
	}

	public override int stFactor()
	{
		return m_stFactor;
	}

	public override string charset()
	{
		return m_charset;
	}

	public nsSJISVerifier()
	{
		m_cclass = new int[32];
		m_cclass[0] = 286331152;
		m_cclass[1] = 1118481;
		m_cclass[2] = 286331153;
		m_cclass[3] = 286327057;
		m_cclass[4] = 286331153;
		m_cclass[5] = 286331153;
		m_cclass[6] = 286331153;
		m_cclass[7] = 286331153;
		m_cclass[8] = 572662306;
		m_cclass[9] = 572662306;
		m_cclass[10] = 572662306;
		m_cclass[11] = 572662306;
		m_cclass[12] = 572662306;
		m_cclass[13] = 572662306;
		m_cclass[14] = 572662306;
		m_cclass[15] = 304226850;
		m_cclass[16] = 858993459;
		m_cclass[17] = 858993459;
		m_cclass[18] = 858993459;
		m_cclass[19] = 858993459;
		m_cclass[20] = 572662308;
		m_cclass[21] = 572662306;
		m_cclass[22] = 572662306;
		m_cclass[23] = 572662306;
		m_cclass[24] = 572662306;
		m_cclass[25] = 572662306;
		m_cclass[26] = 572662306;
		m_cclass[27] = 572662306;
		m_cclass[28] = 858993459;
		m_cclass[29] = 1145393971;
		m_cclass[30] = 1145324612;
		m_cclass[31] = 279620;
		m_states = new int[3];
		m_states[0] = 286339073;
		m_states[1] = 572657937;
		m_states[2] = 4386;
		m_charset = "Shift_JIS";
		m_stFactor = 6;
	}

	public override bool isUCS2()
	{
		return false;
	}
}

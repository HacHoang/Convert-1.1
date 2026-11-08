namespace org.mozilla.intl.chardet;

public class nsGB18030Verifier : nsVerifier
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

	public nsGB18030Verifier()
	{
		m_cclass = new int[32];
		m_cclass[0] = 286331153;
		m_cclass[1] = 1118481;
		m_cclass[2] = 286331153;
		m_cclass[3] = 286327057;
		m_cclass[4] = 286331153;
		m_cclass[5] = 286331153;
		m_cclass[6] = 858993459;
		m_cclass[7] = 286331187;
		m_cclass[8] = 572662306;
		m_cclass[9] = 572662306;
		m_cclass[10] = 572662306;
		m_cclass[11] = 572662306;
		m_cclass[12] = 572662306;
		m_cclass[13] = 572662306;
		m_cclass[14] = 572662306;
		m_cclass[15] = 1109533218;
		m_cclass[16] = 1717986917;
		m_cclass[17] = 1717986918;
		m_cclass[18] = 1717986918;
		m_cclass[19] = 1717986918;
		m_cclass[20] = 1717986918;
		m_cclass[21] = 1717986918;
		m_cclass[22] = 1717986918;
		m_cclass[23] = 1717986918;
		m_cclass[24] = 1717986918;
		m_cclass[25] = 1717986918;
		m_cclass[26] = 1717986918;
		m_cclass[27] = 1717986918;
		m_cclass[28] = 1717986918;
		m_cclass[29] = 1717986918;
		m_cclass[30] = 1717986918;
		m_cclass[31] = 107374182;
		m_states = new int[6];
		m_states[0] = 318767105;
		m_states[1] = 571543825;
		m_states[2] = 17965602;
		m_states[3] = 286326804;
		m_states[4] = 303109393;
		m_states[5] = 17;
		m_charset = "GB18030";
		m_stFactor = 7;
	}

	public override bool isUCS2()
	{
		return false;
	}
}
